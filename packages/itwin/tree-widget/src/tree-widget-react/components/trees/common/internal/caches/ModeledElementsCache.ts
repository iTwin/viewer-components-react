/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, map, mergeMap, reduce, shareReplay } from "rxjs";
import { CLASS_NAME_Model } from "../ClassNameDefinitions.js";
import { catchBeSQLiteInterrupts } from "../UseErrorState.js";
import { getOrCreate } from "../Utils.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Array, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { CategoryId, ElementId, ModelId } from "../Types.js";

interface ModeledElementsCacheProps {
  queryExecutor: LimitingECSqlQueryExecutor;
  componentId: GuidString;
  elementClassName: string;
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
        modelWithCategoryModeledElements: Map<ModelId, Map<CategoryId, Set<ElementId>>>;
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

  private queryModeledElements(): Observable<{
    modelId: Id64String;
    modeledElementId: Id64String;
    categoryId: Id64String;
    parentElements: Id64Array;
  }> {
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
                SELECT p.Parent.Id, CAST(IdToHex(p.ECInstanceId) AS TEXT)
                FROM ${this.#elementClassName} p
                WHERE p.ECInstanceId = me.Parent.Id
                UNION ALL
                SELECT pOfp.Parent.Id, CAST(IdToHex(pOfp.ECInstanceId) AS TEXT) || ';' || c.parentPath
                FROM ${this.#elementClassName} pOfp
                JOIN ModeledElementParents c ON c.parentId = pOfp.ECInstanceId
              )
              SELECT parentPath
              FROM ModeledElementParents
              WHERE parentId IS NULL
            )
          ) parentElements
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
      map((row) => {
        return { modelId: row.modelId, categoryId: row.categoryId, modeledElementId: row.modeledElementId, parentElements: row.parentElements.split(";") };
      }),
    );
  }

  public getModeledElementsInfo() {
    this.#modeledElementsInfo ??= this.queryModeledElements().pipe(
      reduce(
        (acc, { modelId, categoryId, modeledElementId, parentElements }) => {
          const modelEntry = getOrCreate({ map: acc.modelWithCategoryModeledElements, key: modelId, createFunc: () => new Map<CategoryId, Set<ElementId>>() });
          const categoryEntry = getOrCreate({ map: modelEntry, key: categoryId, createFunc: () => new Set<ElementId>() });
          categoryEntry.add(modeledElementId);
          acc.allSubModels.add(modeledElementId);
          parentElements.forEach((parentElementId) => {
            const parentEntry = getOrCreate({ map: acc.childSubModels, key: parentElementId, createFunc: () => new Set<ElementId>() });
            parentEntry.add(modeledElementId);
          });
          return acc;
        },
        {
          modelWithCategoryModeledElements: new Map<ModelId, Map<CategoryId, Set<ElementId>>>(),
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

  public getCategoryModeledElements({ modelId, categoryId }: { modelId: Id64String; categoryId: Id64String }): Observable<Id64String> {
    return this.getModeledElementsInfo().pipe(
      mergeMap(({ modelWithCategoryModeledElements }) => modelWithCategoryModeledElements.get(modelId)?.get(categoryId) ?? new Set<Id64String>()),
    );
  }

  public hasModeledElements({ modelId }: { modelId: Id64String }): Observable<boolean> {
    return this.getModeledElementsInfo().pipe(map(({ modelWithCategoryModeledElements }) => !!modelWithCategoryModeledElements.get(modelId)?.size));
  }
}
