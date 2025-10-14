/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { from, map, mergeMap } from "rxjs";
import { Id64 } from "@itwin/core-bentley";
import {
  CLASS_NAME_Classification,
  CLASS_NAME_ClassificationSystem,
  CLASS_NAME_ClassificationTable,
  CLASS_NAME_DrawingCategory,
  CLASS_NAME_ElementHasClassifications,
  CLASS_NAME_GeometricElement2d,
  CLASS_NAME_GeometricElement3d,
  CLASS_NAME_SpatialCategory,
} from "../../common/internal/ClassNameDefinitions.js";
import { joinId64Arg } from "../../common/internal/Utils.js";

import type { Observable } from "rxjs";
import type { Id64Arg, Id64Array, Id64String } from "@itwin/core-bentley";
import type { ITreeWidgetIdsCache, TreeWidgetIdsCache } from "../../common/internal/TreeWidgetIdsCache.js";
import type { CategoryId, ElementId } from "../../common/internal/Types.js";
import type { HierarchyNodeIdentifiersPath, LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { ClassificationsTreeHierarchyConfiguration } from "../ClassificationsTreeDefinition.js";

/** @internal */
export type ClassificationId = Id64String;
/** @internal */
export type ClassificationTableId = Id64String;

interface ClassificationInfo {
  parentClassificationOrTableId: ClassificationId | ClassificationTableId | undefined;
  childClassificationIds: ClassificationId[];
  relatedCategories2d: CategoryId[];
  relatedCategories3d: CategoryId[];
}

/** @internal */
export class ClassificationsTreeIdsCache implements Disposable, ITreeWidgetIdsCache {
  #classificationInfos: Promise<Map<ClassificationId | ClassificationTableId, ClassificationInfo>> | undefined;
  #filteredElementsData: Promise<Map<ElementId, { modelId: Id64String; categoryId: Id64String }>> | undefined;
  #queryExecutor: LimitingECSqlQueryExecutor;
  #hierarchyConfig: ClassificationsTreeHierarchyConfiguration;
  #treeWidgetIdsCache: TreeWidgetIdsCache;

  constructor(queryExecutor: LimitingECSqlQueryExecutor, hierarchyConfig: ClassificationsTreeHierarchyConfiguration, treeWidgetIdsCache: TreeWidgetIdsCache) {
    this.#queryExecutor = queryExecutor;
    this.#hierarchyConfig = hierarchyConfig;
    this.#treeWidgetIdsCache = treeWidgetIdsCache;
  }

  public [Symbol.dispose]() {}

  public getAllCategoriesThatContainElements() {
    return this.#treeWidgetIdsCache.getAllCategoriesThatContainElements();
  }

  public getCategories(props: Parameters<ITreeWidgetIdsCache["getCategories"]>[0]) {
    return this.#treeWidgetIdsCache.getCategories(props);
  }

  public hasSubModel(props: Parameters<ITreeWidgetIdsCache["hasSubModel"]>[0]) {
    return this.#treeWidgetIdsCache.hasSubModel(props);
  }

  public getElementsCount(props: Parameters<ITreeWidgetIdsCache["getElementsCount"]>[0]) {
    return this.#treeWidgetIdsCache.getElementsCount(props);
  }

  public getModels(props: Parameters<ITreeWidgetIdsCache["getModels"]>[0]) {
    return this.#treeWidgetIdsCache.getModels(props);
  }

  public getSubCategories(props: Parameters<ITreeWidgetIdsCache["getSubCategories"]>[0]) {
    return this.#treeWidgetIdsCache.getSubCategories(props);
  }

  public getSubModels(props: Parameters<ITreeWidgetIdsCache["getSubModels"]>[0]) {
    return this.#treeWidgetIdsCache.getSubModels(props);
  }

  private async *queryClassifications(): AsyncIterableIterator<
    {
      id: Id64String;
      relatedCategories2d: CategoryId[];
      relatedCategories3d: CategoryId[];
    } & ({ tableId: ClassificationTableId; parentId: undefined } | { tableId: undefined; parentId: ClassificationId })
  > {
    const CLASSIFICATIONS_CTE = "Classifications";
    const ctes = [
      `
        ${CLASSIFICATIONS_CTE}(ClassificationId, ClassificationTableId, ParentClassificationId) AS (
          SELECT
            cl.ECInstanceId,
            ct.ECInstanceId,
            NULL
          FROM ${CLASS_NAME_Classification} cl
          JOIN ${CLASS_NAME_ClassificationTable} ct ON ct.ECInstanceId = cl.Model.Id
          JOIN ${CLASS_NAME_ClassificationSystem} cs ON cs.ECInstanceId = ct.Parent.Id
          WHERE
            cs.CodeValue = '${this.#hierarchyConfig.rootClassificationSystemCode}'
            AND NOT ct.IsPrivate
            AND NOT cl.IsPrivate
            AND cl.Parent.Id IS NULL

          UNION ALL

          SELECT
            cl.ECInstanceId,
            NULL,
            cl.Parent.Id
          FROM
            ${CLASSIFICATIONS_CTE} cte
            JOIN ${CLASS_NAME_Classification} cl ON cl.Parent.Id = cte.ClassificationId
          WHERE
            NOT cl.IsPrivate
        )
      `,
    ];
    const ecsql = `
      SELECT
        cl.ClassificationId id,
        cl.ClassificationTableId tableId,
        cl.ParentClassificationId parentId,
        (
          SELECT group_concat(IdToHex(cat.ECInstanceId))
          FROM ${CLASS_NAME_GeometricElement2d} e
          JOIN ${CLASS_NAME_DrawingCategory} cat ON cat.ECInstanceId = e.Category.Id
          JOIN ${CLASS_NAME_ElementHasClassifications} ehc ON ehc.SourceECInstanceId = e.ECInstanceId
          WHERE e.Parent.Id IS NULL AND NOT cat.IsPrivate AND ehc.TargetECInstanceId = cl.ClassificationId
          GROUP BY ehc.TargetECInstanceId
        ) relatedCategories2d,
        (
          SELECT group_concat(IdToHex(cat.ECInstanceId))
          FROM ${CLASS_NAME_GeometricElement3d} e
          JOIN ${CLASS_NAME_SpatialCategory} cat ON cat.ECInstanceId = e.Category.Id
          JOIN ${CLASS_NAME_ElementHasClassifications} ehc ON ehc.SourceECInstanceId = e.ECInstanceId
          WHERE e.Parent.Id IS NULL AND NOT cat.IsPrivate AND ehc.TargetECInstanceId = cl.ClassificationId
          GROUP BY ehc.TargetECInstanceId
        ) relatedCategories3d
      FROM ${CLASSIFICATIONS_CTE} cl
    `;
    for await (const row of this.#queryExecutor.createQueryReader(
      { ctes, ecsql },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: "tree-widget/classifications-tree/classifications-query" },
    )) {
      yield {
        id: row.id,
        tableId: row.tableId,
        parentId: row.parentId,
        relatedCategories2d: row.relatedCategories2d ? (row.relatedCategories2d as string).split(",") : [],
        relatedCategories3d: row.relatedCategories3d ? (row.relatedCategories3d as string).split(",") : [],
      };
    }
  }

  private async getClassificationsInfo() {
    this.#classificationInfos ??= (async () => {
      const classificationInfos = new Map<ClassificationId | ClassificationTableId, ClassificationInfo>();
      for await (const { id, tableId, parentId, relatedCategories2d, relatedCategories3d } of this.queryClassifications()) {
        const tableOrParentId = tableId ?? parentId;
        let parentInfo = classificationInfos.get(tableOrParentId);
        if (!parentInfo) {
          parentInfo = { childClassificationIds: [], relatedCategories2d: [], relatedCategories3d: [], parentClassificationOrTableId: undefined };
          classificationInfos.set(tableOrParentId, parentInfo);
        }
        parentInfo.childClassificationIds.push(id);
        let classificationEntry = classificationInfos.get(id);
        if (!classificationEntry) {
          classificationEntry = { childClassificationIds: [], relatedCategories2d, relatedCategories3d, parentClassificationOrTableId: tableOrParentId };
          classificationInfos.set(id, classificationEntry);
        } else {
          classificationEntry.parentClassificationOrTableId = tableOrParentId;
        }
      }
      return classificationInfos;
    })();
    return this.#classificationInfos;
  }

  public async getAllContainedCategories(classificationOrTableIds: Id64Arg): Promise<{ drawing: Id64Array; spatial: Id64Array }> {
    const result = { drawing: new Array<CategoryId>(), spatial: new Array<CategoryId>() };
    if (Id64.sizeOf(classificationOrTableIds) === 0) {
      return result;
    }
    const classificationsInfo = await this.getClassificationsInfo();
    const promises = new Array<Promise<{ drawing: Id64Array; spatial: Id64Array }>>();
    for (const classificationOrTableId of Id64.iterable(classificationOrTableIds)) {
      const classificationInfo = classificationsInfo.get(classificationOrTableId);
      if (classificationInfo === undefined) {
        continue;
      }
      result.drawing.push(...classificationInfo.relatedCategories2d);
      result.spatial.push(...classificationInfo.relatedCategories3d);
      promises.push(this.getAllContainedCategories(classificationInfo.childClassificationIds));
    }
    const promisesResult = await Promise.all(promises);
    for (const { drawing, spatial } of promisesResult) {
      result.drawing.push(...drawing);
      result.spatial.push(...spatial);
    }
    return result;
  }

  public async getDirectChildClassifications(classificationOrTableIds: Id64Arg): Promise<ClassificationId[]> {
    const result = new Array<ClassificationId>();
    if (Id64.sizeOf(classificationOrTableIds) === 0) {
      return result;
    }
    const classificationsInfo = await this.getClassificationsInfo();
    for (const classificationOrTableId of Id64.iterable(classificationOrTableIds)) {
      const classificationInfo = classificationsInfo.get(classificationOrTableId);
      if (classificationInfo === undefined) {
        continue;
      }
      result.push(...classificationInfo.childClassificationIds);
    }
    return result;
  }

  public getClassificationsPathObs(classificationIds: Id64Arg): Observable<HierarchyNodeIdentifiersPath> {
    return from(this.getClassificationsInfo()).pipe(
      mergeMap((classificationsInfo) => {
        return from(Id64.iterable(classificationIds)).pipe(
          map((classificationId) => {
            const path: HierarchyNodeIdentifiersPath = [{ id: classificationId, className: CLASS_NAME_Classification }];
            let parentId = classificationsInfo.get(classificationId)?.parentClassificationOrTableId;
            while (parentId !== undefined) {
              const parentIdOfParent = classificationsInfo.get(parentId)?.parentClassificationOrTableId;
              if (parentIdOfParent) {
                path.push({ className: CLASS_NAME_Classification, id: parentId });
              } else {
                path.push({ className: CLASS_NAME_ClassificationTable, id: parentId });
              }
              parentId = parentIdOfParent;
            }
            return path.reverse();
          }),
        );
      }),
    );
  }

  public async getAllClassifications(): Promise<ClassificationId[]> {
    const classificationsInfo = await this.getClassificationsInfo();
    return [...classificationsInfo.keys()];
  }

  private async *queryFilteredElementsData({ element2dIds, element3dIds }: { element2dIds: Id64Arg; element3dIds: Id64Arg }): AsyncIterableIterator<{
    modelId: Id64String;
    id: ElementId;
    categoryId: Id64String;
  }> {
    const queries = new Array<string>();
    if (Id64.sizeOf(element2dIds) > 0) {
      queries.push(`
        SELECT Model.Id modelId, Category.Id categoryId, ECInstanceId id
        FROM ${CLASS_NAME_GeometricElement2d}
        WHERE ECInstanceId IN (${joinId64Arg(element2dIds, ",")})
      `);
    }
    if (Id64.sizeOf(element3dIds) > 0) {
      queries.push(`
        SELECT Model.Id modelId, Category.Id categoryId, ECInstanceId id
        FROM ${CLASS_NAME_GeometricElement3d}
        WHERE ECInstanceId IN (${joinId64Arg(element3dIds, ",")})
      `);
    }
    for await (const row of this.#queryExecutor.createQueryReader(
      { ecsql: queries.join(" UNION ALL ") },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded" },
    )) {
      yield { modelId: row.modelId, id: row.id, categoryId: row.categoryId };
    }
  }

  public async getFilteredElementsData({
    element2dIds,
    element3dIds,
  }: {
    element2dIds: Id64Arg;
    element3dIds: Id64Arg;
  }): Promise<Map<ElementId, { categoryId: Id64String; modelId: Id64String }>> {
    if (Id64.sizeOf(element2dIds) === 0 && Id64.sizeOf(element3dIds) === 0) {
      return new Map();
    }

    this.#filteredElementsData ??= (async () => {
      const filteredElementsData = new Map();
      for await (const { modelId, id, categoryId } of this.queryFilteredElementsData({
        element2dIds,
        element3dIds,
      })) {
        filteredElementsData.set(id, { modelId, categoryId });
      }
      return filteredElementsData;
    })();
    return this.#filteredElementsData;
  }

  public clearFilteredElementsData() {
    this.#filteredElementsData = undefined;
  }
}
