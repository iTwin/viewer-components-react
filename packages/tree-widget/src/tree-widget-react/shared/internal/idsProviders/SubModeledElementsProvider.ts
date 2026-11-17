/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, EMPTY, map, mergeMap, reduce } from "rxjs";
import { catchBeSQLiteInterrupts } from "../hooks/UseErrorState.js";
import { ChildrenTree, getOrCreate } from "../Utils.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Array, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { ElementId, ModelId } from "../Types.js";

type SubModelsTree = ChildrenTree<{ type: "model" | "category" | "element"; directSubModels: Array<ElementId> }>;

/**
 * Sub-modeled elements data used by tree widget. Extends data of `@itwin/presentation-tree-definitions`
 * shared ids provider, so it can be supplied through its `loadDataOverrides.loadSubModeledElements`.
 *
 * Element IDs here are also model IDs, since those elements are sub-models.
 * @internal
 */
export interface SubModeledElementsData {
  subModelsTree: SubModelsTree;
  allSubModels: Set<ElementId>;
  childSubModels: Map<ElementId, Set<ElementId>>;
}

interface QueriedRow {
  modelId: Id64String;
  modeledElementId: Id64String;
  categoryId: Id64String;
  categoryElementPath: Id64Array;
}

/**
 * Loads sub-modeled elements of the given class, that are located in the given models.
 * @internal
 */
export function loadSubModeledElements(props: {
  queryExecutor: LimitingECSqlQueryExecutor;
  componentId: GuidString;
  elementClassName: string;
  getNonEmptyModelIds: () => Observable<ReadonlySet<ModelId>>;
}): Observable<SubModeledElementsData> {
  return props.getNonEmptyModelIds().pipe(
    mergeMap((nonEmptyModelIds) => queryModeledElements({ ...props, nonEmptyModelIds })),
    reduce<QueriedRow, SubModeledElementsData>(
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
  );
}

function queryModeledElements({
  queryExecutor,
  componentId,
  elementClassName,
  nonEmptyModelIds,
}: {
  queryExecutor: LimitingECSqlQueryExecutor;
  componentId: GuidString;
  elementClassName: string;
  nonEmptyModelIds: ReadonlySet<ModelId>;
}): Observable<QueriedRow> {
  if (nonEmptyModelIds.size === 0) {
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
              FROM ${elementClassName} p
              WHERE p.ECInstanceId = me.Parent.Id
              UNION ALL
              SELECT pOfp.Parent.Id, CAST(IdToHex(pOfp.Category.Id) AS TEXT) || ';' || CAST(IdToHex(pOfp.ECInstanceId) AS TEXT) || ';' || c.parentPath
              FROM ${elementClassName} pOfp
              JOIN ModeledElementParents c ON c.parentId = pOfp.ECInstanceId
            )
            SELECT parentPath
            FROM ModeledElementParents
            WHERE parentId IS NULL
          )
        ) categoryElementPath
      FROM ${elementClassName} me
      JOIN IdSet(?) modelIdSet ON modelIdSet.id = me.ECInstanceId
    `;
    return queryExecutor.createQueryReader(
      { ecsql: query, bindings: [{ type: "idset", value: [...nonEmptyModelIds] }] },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `SubModeledElementsProvider/${componentId}/modeled-elements` },
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
