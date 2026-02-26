/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, from, map, mergeMap, of, reduce, shareReplay } from "rxjs";
import { Guid, Id64 } from "@itwin/core-bentley";
import { BaseIdsCacheImpl } from "../../common/internal/caches/BaseIdsCache.js";
import {
  CLASS_NAME_Classification,
  CLASS_NAME_ClassificationSystem,
  CLASS_NAME_ClassificationTable,
  CLASS_NAME_ElementHasClassifications,
  CLASS_NAME_GeometricElement3d,
  CLASS_NAME_SpatialCategory,
} from "../../common/internal/ClassNameDefinitions.js";
import { catchBeSQLiteInterrupts } from "../../common/internal/UseErrorState.js";
import { joinId64Arg } from "../../common/internal/Utils.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Arg, Id64Array, Id64String } from "@itwin/core-bentley";
import type { HierarchyNodeIdentifiersPath, LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { BaseIdsCacheImplProps } from "../../common/internal/caches/BaseIdsCache.js";
import type { CategoryId, ClassificationId, ClassificationTableId, ElementId } from "../../common/internal/Types.js";
import type { ClassificationsTreeHierarchyConfiguration } from "../ClassificationsTreeDefinition.js";

interface ClassificationInfo {
  parentClassificationOrTableId: ClassificationId | ClassificationTableId | undefined;
  childClassificationIds: ClassificationId[];
  relatedCategories: CategoryId[];
}

interface ClassificationsTreeIdsCacheProps extends BaseIdsCacheImplProps {
  queryExecutor: LimitingECSqlQueryExecutor;
  hierarchyConfig: ClassificationsTreeHierarchyConfiguration;
}

/** @internal */
export class ClassificationsTreeIdsCache extends BaseIdsCacheImpl {
  #classificationInfos: Observable<Map<ClassificationId | ClassificationTableId, ClassificationInfo>> | undefined;
  #filteredElementsData: Observable<Map<ElementId, { modelId: Id64String; categoryId: Id64String; categoryOfTopMostParentElement: CategoryId }>> | undefined;
  #queryExecutor: LimitingECSqlQueryExecutor;
  #hierarchyConfig: ClassificationsTreeHierarchyConfiguration;
  #componentId: GuidString;
  #componentName: string;

  constructor(props: ClassificationsTreeIdsCacheProps) {
    super(props);
    this.#queryExecutor = props.queryExecutor;
    this.#hierarchyConfig = props.hierarchyConfig;
    this.#componentId = Guid.createValue();
    this.#componentName = "ClassificationsTreeIdsCache";
  }

  private queryClassifications(): Observable<
    {
      id: Id64String;
      relatedCategories: CategoryId[];
    } & ({ tableId: ClassificationTableId; parentId: undefined } | { tableId: undefined; parentId: ClassificationId })
  > {
    return defer(() => {
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
            FROM ${CLASS_NAME_GeometricElement3d} e
            JOIN ${CLASS_NAME_SpatialCategory} cat ON cat.ECInstanceId = e.Category.Id
            JOIN ${CLASS_NAME_ElementHasClassifications} ehc ON ehc.SourceECInstanceId = e.ECInstanceId
            WHERE e.Parent.Id IS NULL AND NOT cat.IsPrivate AND ehc.TargetECInstanceId = cl.ClassificationId
            GROUP BY ehc.TargetECInstanceId
          ) relatedCategories
        FROM ${CLASSIFICATIONS_CTE} cl
      `;
      return this.#queryExecutor.createQueryReader(
        { ctes, ecsql },
        { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/classifications` },
      );
    }).pipe(
      catchBeSQLiteInterrupts,
      map((row) => {
        return {
          id: row.id,
          tableId: row.tableId,
          parentId: row.parentId,
          relatedCategories: row.relatedCategories ? (row.relatedCategories as string).split(",") : [],
        };
      }),
    );
  }

  private getClassificationsInfo() {
    this.#classificationInfos ??= this.queryClassifications().pipe(
      reduce((acc, { id, tableId, parentId, relatedCategories }) => {
        const tableOrParentId = tableId ?? parentId;
        let parentInfo = acc.get(tableOrParentId);
        if (!parentInfo) {
          parentInfo = { childClassificationIds: [], relatedCategories: [], parentClassificationOrTableId: undefined };
          acc.set(tableOrParentId, parentInfo);
        }
        parentInfo.childClassificationIds.push(id);
        let classificationEntry = acc.get(id);
        if (!classificationEntry) {
          classificationEntry = { childClassificationIds: [], relatedCategories, parentClassificationOrTableId: tableOrParentId };
          acc.set(id, classificationEntry);
        } else {
          classificationEntry.parentClassificationOrTableId = tableOrParentId;
        }
        return acc;
      }, new Map<ClassificationId | ClassificationTableId, ClassificationInfo>()),
      shareReplay(),
    );
    return this.#classificationInfos;
  }

  public getAllContainedCategories(classificationOrTableIds: Id64Arg): Observable<Id64Array> {
    const result = new Array<CategoryId>();
    if (Id64.sizeOf(classificationOrTableIds) === 0) {
      return of(result);
    }
    return this.getClassificationsInfo().pipe(
      mergeMap((classificationsInfo) =>
        from(Id64.iterable(classificationOrTableIds)).pipe(
          reduce(
            (acc, classificationOrTableId) => {
              const classificationInfo = classificationsInfo.get(classificationOrTableId);
              if (classificationInfo === undefined) {
                return acc;
              }
              classificationInfo.relatedCategories.forEach((id) => acc.categories.push(id));
              classificationInfo.childClassificationIds.forEach((id) => acc.childClassifications.push(id));
              return acc;
            },
            { categories: new Array<CategoryId>(), childClassifications: new Array<Id64String>() },
          ),
          mergeMap(({ categories, childClassifications }) => {
            if (childClassifications.length === 0) {
              return of(categories);
            }
            return this.getAllContainedCategories(childClassifications).pipe(
              map((childCategories) => {
                childCategories.forEach((id) => categories.push(id));
                return categories;
              }),
            );
          }),
        ),
      ),
    );
  }

  public getDirectChildClassifications(classificationOrTableIds: Id64Arg): Observable<ClassificationId[]> {
    const result = new Array<ClassificationId>();
    if (Id64.sizeOf(classificationOrTableIds) === 0) {
      return of(result);
    }
    return this.getClassificationsInfo().pipe(
      mergeMap((classificationsInfo) =>
        from(Id64.iterable(classificationOrTableIds)).pipe(
          reduce((acc, classificationOrTableId) => {
            const classificationInfo = classificationsInfo.get(classificationOrTableId);
            if (classificationInfo !== undefined) {
              classificationInfo.childClassificationIds.forEach((id) => acc.push(id));
            }
            return acc;
          }, result),
        ),
      ),
    );
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

  public getAllClassifications(): Observable<ClassificationId[]> {
    return this.getClassificationsInfo().pipe(map((classificationsInfo) => [...classificationsInfo.keys()]));
  }

  private queryFilteredElementsData({ elementIds }: { elementIds: Id64Arg }): Observable<{
    modelId: Id64String;
    id: ElementId;
    categoryId: Id64String;
    categoryOfTopMostParentElement: Id64String;
  }> {
    return defer(() => {
      const query = `
        SELECT
          this.Model.Id modelId,
          this.Category.Id categoryId,
          this.ECInstanceId id,
          (
            WITH RECURSIVE
              ParentWithCategory(id, categoryId, parentId) AS (
                SELECT e.ECInstanceId, e.Category.Id, e.Parent.Id
                FROM ${CLASS_NAME_GeometricElement3d} e
                WHERE e.ECInstanceId = this.ECInstanceId
                UNION ALL
                SELECT p.ECInstanceId, p.Category.Id, p.Parent.Id
                FROM ${CLASS_NAME_GeometricElement3d} p
                JOIN ParentWithCategory c ON p.ECInstanceId = c.parentId
              )
            SELECT IdToHex(categoryId)
            FROM ParentWithCategory
            WHERE parentId IS NULL
          ) categoryOfTopMostParentElement
        FROM ${CLASS_NAME_GeometricElement3d} this
        WHERE ECInstanceId IN (${joinId64Arg(elementIds, ",")})
      `;
      return this.#queryExecutor.createQueryReader(
        { ecsql: query },
        {
          rowFormat: "ECSqlPropertyNames",
          limit: "unbounded",
          restartToken: `${this.#componentName}/${this.#componentId}/filtered-elements/${Guid.createValue()}`,
        },
      );
    }).pipe(
      catchBeSQLiteInterrupts,
      map((row) => {
        return {
          modelId: row.modelId,
          id: row.id,
          categoryId: row.categoryId,
          categoryOfTopMostParentElement: row.categoryOfTopMostParentElement,
        };
      }),
    );
  }

  public getFilteredElementsData({
    elementIds,
  }: {
    elementIds: Id64Arg;
  }): Observable<Map<ElementId, { categoryId: Id64String; modelId: Id64String; categoryOfTopMostParentElement: CategoryId }>> {
    const result = new Map<ElementId, { categoryId: Id64String; modelId: Id64String; categoryOfTopMostParentElement: CategoryId }>();
    if (Id64.sizeOf(elementIds) === 0) {
      return of(result);
    }
    this.#filteredElementsData ??= this.queryFilteredElementsData({
      elementIds,
    }).pipe(
      reduce((acc, { modelId, id, categoryId, categoryOfTopMostParentElement }) => {
        acc.set(id, { modelId, categoryId, categoryOfTopMostParentElement });
        return acc;
      }, result),
      shareReplay(),
    );
    return this.#filteredElementsData;
  }

  public clearFilteredElementsData() {
    this.#filteredElementsData = undefined;
  }
}
