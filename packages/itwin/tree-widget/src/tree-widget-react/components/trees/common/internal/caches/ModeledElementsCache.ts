/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, map, mergeMap, reduce, shareReplay } from "rxjs";
import { CLASS_NAME_Model } from "../ClassNameDefinitions.js";
import { catchBeSQLiteInterrupts } from "../UseErrorState.js";
import { ChildrenTree, getOrCreate } from "../Utils.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { CategoryId, ElementId, ModelId } from "../Types.js";
import type { ParentElementsPath } from "../Utils.js";

interface ModeledElementsCacheProps {
  queryExecutor: LimitingECSqlQueryExecutor;
  componentId: GuidString;
  elementClassName: string;
}
type SubModelsTree = ChildrenTree<{ type: "model" | "category" | "element"; directSubModels: Array<ElementId> }>;

interface QueriedRow {
  modelId: Id64String;
  modeledElementId: Id64String;
  categoryId: Id64String;
  categoryElementPath: Id64Array;
}

/** @internal */
export class ModeledElementsCache {
  #queryExecutor: LimitingECSqlQueryExecutor;
  #componentId: GuidString;
  #componentName: string;
  #elementClassName: string;
  // ElementId here is also a ModelId, since those elements are sub models.
  #modeledElementsInfo:
    | Observable<{
        subModelsTree: SubModelsTree;
        allSubModels: Set<ElementId>;
        childSubModels: Map<ElementId, Set<ElementId>>;
      }>
    | undefined;

  constructor(props: ModeledElementsCacheProps) {
    this.#queryExecutor = props.queryExecutor;
    this.#componentId = props.componentId;
    this.#elementClassName = props.elementClassName;
    this.#componentName = "ModeledElementsCache";
  }

  private queryModeledElements(): Observable<QueriedRow> {
    // TODO two sub-models nested under one another. Might not work with pare
    return defer(() => {
      const query = `
        SELECT
          me.ECInstanceId modeledElementId,
          me.Category.Id categoryId,
          me.Model.Id modelId,
          IIF(me.Parent.Id IS NULL,
            '',
            (
              WITH RECURSIVE ModeledElementParents(parentId, parentPath) AS (
                SELECT p.Parent.Id, CAST(IdToHex(p.Category.Id) AS TEXT) || ';' || CAST(IdToHex(p.ECInstanceId) AS TEXT)
                FROM ${this.#elementClassName} p
                WHERE p.ECInstanceId = me.Parent.Id
                UNION ALL
                SELECT pOfp.Parent.Id, CAST(IdToHex(pOfp.Category.Id) AS TEXT) || ';' || CAST(IdToHex(pOfp.ECInstanceId) AS TEXT) || ';' || c.parentPath
                FROM ${this.#elementClassName} pOfp
                JOIN ModeledElementParents c ON c.parentId = pOfp.ECInstanceId
              )
              SELECT parentPath
              FROM ModeledElementParents
              WHERE parentId IS NULL
            )
          ) categoryElementPath
        FROM ${CLASS_NAME_Model} m
        JOIN ${this.#elementClassName} me ON me.ECInstanceId = m.ModeledElement.Id
        WHERE
          m.IsPrivate = false
          AND m.ECInstanceId IN (SELECT Model.Id FROM ${this.#elementClassName})
      `;
      return this.#queryExecutor.createQueryReader(
        { ecsql: query },
        { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/modeled-elements` },
      );
    }).pipe(
      catchBeSQLiteInterrupts,
      map((row): QueriedRow => {
        return {
          modelId: row.modelId,
          categoryId: row.categoryId,
          modeledElementId: row.modeledElementId,
          categoryElementPath: row.categoryElementPath === "" ? [] : row.categoryElementPath.split(";"),
        };
      }),
    );
  }

  public getModeledElementsInfo() {
    this.#modeledElementsInfo ??= this.queryModeledElements().pipe(
      reduce<QueriedRow, { subModelsTree: SubModelsTree; allSubModels: Set<ElementId>; childSubModels: Map<ElementId, Set<ElementId>> }>(
        (acc, { modelId, categoryId, modeledElementId, categoryElementPath }) => {
          ChildrenTree.update({
            tree: acc.subModelsTree,
            idsToAdd: [modelId, ...categoryElementPath, categoryId],
            additionalPropsGetter: ({ id, additionalProps, depth }) => {
              let newAdditionalProps = additionalProps;
              if (!newAdditionalProps) {
                newAdditionalProps = { type: id === modelId ? "model" : depth % 2 === 1 ? "category" : "element", directSubModels: [] };
              }
              if (id === categoryId) {
                newAdditionalProps.directSubModels.push(modeledElementId);
              }
              return newAdditionalProps;
            },
          });
          for (let i = 1; i < categoryElementPath.length; i += 2) {
            const elementId = categoryElementPath[i];
            const childSubModelsEntry = getOrCreate({ map: acc.childSubModels, key: elementId, createFunc: () => new Set<ElementId>() });
            childSubModelsEntry.add(modeledElementId);
          }
          acc.allSubModels.add(modeledElementId);
          return acc;
        },
        {
          subModelsTree: new Map(),
          allSubModels: new Set<ElementId>(),
          childSubModels: new Map<ElementId, Set<ElementId>>(),
        },
      ),
      shareReplay(),
    );
    return this.#modeledElementsInfo;
  }

  public getSubModelsUnderElement(elementId: Id64String): Observable<Id64Array> {
    return this.getModeledElementsInfo().pipe(
      map(({ allSubModels, childSubModels }) => {
        if (allSubModels.has(elementId)) {
          // If element is a sub-model, it can not be a parent.
          return [elementId];
        }
        // Convert sub-models set into array.
        // When element does not contain sub-model, return empty array.
        return [...(childSubModels.get(elementId) ?? [])];
      }),
    );
  }

  public getCategoryModeledElements({
    modelIds,
    categoryIds,
    parentElementsPath,
  }: {
    modelIds: Id64Set;
    categoryIds: Id64Set;
    parentElementsPath: ParentElementsPath;
  }): Observable<Id64String> {
    return this.getModeledElementsInfo().pipe(
      mergeMap(({ subModelsTree }) => {
        const accumulator = new Array<ElementId>();
        const childrenTreeAsArray = new Array<Set<ElementId | CategoryId | ModelId>>();
        childrenTreeAsArray.push(modelIds);
        for (const { categoryIds: parentCategoryId, elementIds } of parentElementsPath) {
          childrenTreeAsArray.push(new Set([parentCategoryId]));
          childrenTreeAsArray.push(new Set(elementIds));
        }
        childrenTreeAsArray.push(categoryIds);
        ChildrenTree.collect({
          tree: subModelsTree,
          addToAccumulator: ({ treeEntry, key, depth }) => {
            if (depth < childrenTreeAsArray.length) {
              // when entry in children tree does not exist in the childrenTreeAsArray
              // it means that this branch of the tree is not in the path specified by parentElementsPath
              // children can be ignored
              if (!childrenTreeAsArray[depth].has(key)) {
                return { ignoreChildren: true };
              }
              if (depth === childrenTreeAsArray.length - 1) {
                accumulator.push(...treeEntry.directSubModels);
              }
              return { ignoreChildren: false };
            }
            accumulator.push(...treeEntry.directSubModels);
            return { ignoreChildren: false };
          },
        });
        return accumulator;
      }),
    );
  }

  public hasModeledElements({ modelId }: { modelId: Id64String }): Observable<boolean> {
    // subModelsTree contains modelId only when it has a modeled element.
    return this.getModeledElementsInfo().pipe(map(({ subModelsTree }) => subModelsTree.has(modelId)));
  }
}
