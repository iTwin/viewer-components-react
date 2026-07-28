/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, EMPTY, map, reduce, shareReplay } from "rxjs";
import { catchBeSQLiteInterrupts } from "../hooks/UseErrorState.js";
import { ChildrenTree, getOrCreate } from "../Utils.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Array, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { ElementId, ModelId } from "../Types.js";

interface ModeledElementsCacheProps {
  queryExecutor: LimitingECSqlQueryExecutor;
  componentId: GuidString;
  elementClassName: string;
  nonEmptyModelIds: Array<ModelId>;
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
  #nonEmptyModelIds: Array<ModelId>;
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
    this.#nonEmptyModelIds = props.nonEmptyModelIds;
  }

  private queryModeledElements(): Observable<QueriedRow> {
    if (this.#nonEmptyModelIds.length === 0) {
      return EMPTY;
    }
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
        FROM ${this.#elementClassName} me
        JOIN IdSet(?) modelIdSet ON modelIdSet.id = me.ECInstanceId
      `;
      return this.#queryExecutor.createQueryReader(
        { ecsql: query, bindings: [{ type: "idset", value: this.#nonEmptyModelIds }] },
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
}
