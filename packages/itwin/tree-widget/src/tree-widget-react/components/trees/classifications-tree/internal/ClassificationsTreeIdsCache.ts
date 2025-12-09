/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, EMPTY, forkJoin, from, map, mergeMap, of, reduce, shareReplay, toArray } from "rxjs";
import { Guid, Id64 } from "@itwin/core-bentley";
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
import { ModelCategoryElementsCountCache } from "../../common/internal/ModelCategoryElementsCountCache.js";
import { getDistinctMapValues, joinId64Arg } from "../../common/internal/Utils.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchyNodeIdentifiersPath, LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { CategoryId, ElementId, ModelId } from "../../common/internal/Types.js";
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
export class ClassificationsTreeIdsCache implements Disposable {
  readonly #categoryElementCounts: ModelCategoryElementsCountCache;
  #elementModelsCategories: Observable<Map<ModelId, { category2dIds: Id64Set; category3dIds: Id64Set; isSubModel: boolean }>> | undefined;
  #modelWithCategoryModeledElements: Observable<Map<ModelId, Map<CategoryId, Set<ElementId>>>> | undefined;
  #classificationInfos: Observable<Map<ClassificationId | ClassificationTableId, ClassificationInfo>> | undefined;
  #filteredElementsData: Observable<Map<ElementId, { modelId: Id64String; categoryId: Id64String }>> | undefined;
  #queryExecutor: LimitingECSqlQueryExecutor;
  #hierarchyConfig: ClassificationsTreeHierarchyConfiguration;
  #componentId: GuidString;
  #componentName: string;

  constructor(queryExecutor: LimitingECSqlQueryExecutor, hierarchyConfig: ClassificationsTreeHierarchyConfiguration, componentId?: GuidString) {
    this.#queryExecutor = queryExecutor;
    this.#hierarchyConfig = hierarchyConfig;
    this.#componentId = componentId ?? Guid.createValue();
    this.#componentName = "ClassificationsTreeIdsCache";
    this.#categoryElementCounts = new ModelCategoryElementsCountCache(
      this.#queryExecutor,
      ["BisCore.GeometricElement2d", "BisCore.GeometricElement3d"],
      this.#componentId,
    );
  }

  public [Symbol.dispose]() {
    this.#categoryElementCounts[Symbol.dispose]();
  }

  private queryElementModelCategories(): Observable<{
    modelId: Id64String;
    categoryId: Id64String;
    type: "2d" | "3d";
  }> {
    return defer(() => {
      const query = `
        SELECT * FROM (
          SELECT '3d' type, this.Model.Id modelId, this.Category.Id categoryId
          FROM BisCore.GeometricModel m
          JOIN BisCore.GeometricElement3d this ON m.ECInstanceId = this.Model.Id
          WHERE this.Parent.Id IS NULL AND m.IsPrivate = false
          GROUP BY modelId, categoryId
        )
        UNION ALL
        SELECT * FROM (
          SELECT '2d' type, this.Model.Id modelId, this.Category.Id categoryId
          FROM BisCore.GeometricModel m
          JOIN BisCore.GeometricElement2d this ON m.ECInstanceId = this.Model.Id
          WHERE this.Parent.Id IS NULL AND m.IsPrivate = false
          GROUP BY modelId, categoryId
        )
      `;
      return this.#queryExecutor.createQueryReader(
        { ecsql: query },
        { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/element-models-and-categories` },
      );
    }).pipe(
      map((row) => {
        return { modelId: row.modelId, categoryId: row.categoryId, type: row.type };
      }),
    );
  }

  private getElementModelsCategories() {
    this.#elementModelsCategories ??= forkJoin({
      modelCategories: this.queryElementModelCategories().pipe(
        reduce((acc, queriedCategory) => {
          let modelEntry = acc.get(queriedCategory.modelId);
          if (modelEntry === undefined) {
            modelEntry = { category2dIds: new Set(), category3dIds: new Set() };
            acc.set(queriedCategory.modelId, modelEntry);
          }
          switch (queriedCategory.type) {
            case "2d":
              modelEntry.category2dIds.add(queriedCategory.categoryId);
              break;
            case "3d":
              modelEntry.category3dIds.add(queriedCategory.categoryId);
              break;
          }
          return acc;
        }, new Map<ModelId, { category2dIds: Id64Set; category3dIds: Id64Set }>()),
      ),
      modelWithCategoryModeledElements: this.getModelWithCategoryModeledElements(),
    }).pipe(
      map(({ modelCategories, modelWithCategoryModeledElements }) => {
        const result = new Map<ModelId, { category2dIds: Id64Set; category3dIds: Id64Set; isSubModel: boolean }>();
        const subModels = new Set<Id64String>();
        modelWithCategoryModeledElements.forEach((categoryMap) =>
          categoryMap.forEach((categorySubModels) => categorySubModels.forEach((subModelId) => subModels.add(subModelId))),
        );
        for (const [modelId, modelEntry] of modelCategories) {
          const isSubModel = subModels.has(modelId);
          result.set(modelId, { category2dIds: modelEntry.category2dIds, category3dIds: modelEntry.category3dIds, isSubModel });
        }
        return result;
      }),
      shareReplay(),
    );
    return this.#elementModelsCategories;
  }

  private queryModeledElements(): Observable<{
    modelId: Id64String;
    modeledElementId: Id64String;
    categoryId: Id64String;
    rootCategoryId: Id64String;
  }> {
    return defer(() => {
      const query = `
        SELECT
          pe.ECInstanceId modeledElementId,
          pe.Category.Id categoryId,
          pe.Model.Id modelId
        FROM BisCore.GeometricModel m
        JOIN BisCore.GeometricElement3d pe ON pe.ECInstanceId = m.ModeledElement.Id
        WHERE
          m.IsPrivate = false
          AND m.ECInstanceId IN (SELECT Model.Id FROM BisCore.Element)
        UNION ALL
        SELECT
          pe.ECInstanceId modeledElementId,
          pe.Category.Id categoryId,
          pe.Model.Id modelId
        FROM BisCore.GeometricModel m
        JOIN BisCore.GeometricElement2d pe ON pe.ECInstanceId = m.ModeledElement.Id
        WHERE
          m.IsPrivate = false
          AND m.ECInstanceId IN (SELECT Model.Id FROM BisCore.Element)
      `;
      return this.#queryExecutor.createQueryReader(
        { ecsql: query },
        { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/modeled-elements` },
      );
    }).pipe(
      map((row) => {
        return { modelId: row.modelId, categoryId: row.categoryId, modeledElementId: row.modeledElementId, rootCategoryId: row.rootCategoryId };
      }),
    );
  }

  private getModelWithCategoryModeledElements() {
    this.#modelWithCategoryModeledElements ??= this.queryModeledElements().pipe(
      reduce((acc, { modelId, categoryId, modeledElementId }) => {
        let modelEntry = acc.get(modelId);
        if (!modelEntry) {
          modelEntry = new Map();
          acc.set(modelId, modelEntry);
        }
        const categoryEntry = modelEntry.get(categoryId);
        if (!categoryEntry) {
          modelEntry.set(categoryId, new Set([modeledElementId]));
        } else {
          categoryEntry.add(modeledElementId);
        }
        return acc;
      }, new Map<ModelId, Map<CategoryId, Set<ElementId>>>()),
      shareReplay(),
    );
    return this.#modelWithCategoryModeledElements;
  }

  public getCategoriesModeledElements(modelId: Id64String, categoryIds: Id64Arg): Observable<Id64Array> {
    return this.getModelWithCategoryModeledElements().pipe(
      mergeMap((modelWithCategoryModeledElements) => {
        const result = new Array<ElementId>();
        const categoryMap = modelWithCategoryModeledElements.get(modelId);
        if (!categoryMap) {
          return of(result);
        }
        return from(Id64.iterable(categoryIds)).pipe(
          map((categoryId) => categoryMap.get(categoryId)),
          mergeMap((elementsSet) => (elementsSet ? from(elementsSet) : EMPTY)),
          toArray(),
        );
      }),
    );
  }

  public getCategoriesElementModels(categoryIds: Id64Arg, includeSubModels?: boolean): Observable<{ id: CategoryId; models: Array<ModelId> | undefined }> {
    return this.getElementModelsCategories().pipe(
      mergeMap((elementModelsCategories) =>
        from(Id64.iterable(categoryIds)).pipe(
          map((categoryId) => {
            const categoryModels = new Array<ModelId>();
            elementModelsCategories.forEach(({ category2dIds, category3dIds, isSubModel }, modelId) => {
              if ((includeSubModels || !isSubModel) && (category2dIds.has(categoryId) || category3dIds.has(categoryId))) {
                categoryModels.push(modelId);
              }
            });
            return { id: categoryId, models: categoryModels.length > 0 ? categoryModels : undefined };
          }),
        ),
      ),
    );
  }

  public getModelCategoryIds(modelId: Id64String): Observable<{ drawing: Id64Array; spatial: Id64Array }> {
    return this.getElementModelsCategories().pipe(
      map((elementModelsCategories) => {
        return {
          drawing: Array.from(elementModelsCategories.get(modelId)?.category2dIds ?? []),
          spatial: Array.from(elementModelsCategories.get(modelId)?.category3dIds ?? []),
        };
      }),
    );
  }

  public getAllCategories(): Observable<{ drawing: Id64Set; spatial: Id64Set }> {
    return this.getElementModelsCategories().pipe(
      mergeMap((modelsCategoriesInfo) => modelsCategoriesInfo.values()),
      reduce(
        (acc, { category2dIds, category3dIds }) => {
          category2dIds.forEach((id) => acc.drawing.add(id));
          category3dIds.forEach((id) => acc.spatial.add(id));
          return acc;
        },
        { drawing: new Set<Id64String>(), spatial: new Set<Id64String>() },
      ),
    );
  }

  public hasSubModel(elementId: Id64String): Observable<boolean> {
    return this.getElementModelsCategories().pipe(map((elementModelsCategories) => elementModelsCategories.has(elementId)));
  }

  public getCategoryElementsCount(modelId: Id64String, categoryId: Id64String): Observable<number> {
    return this.#categoryElementCounts.getCategoryElementsCount(modelId, categoryId);
  }

  private queryClassifications(): Observable<
    {
      id: Id64String;
      relatedCategories2d: CategoryId[];
      relatedCategories3d: CategoryId[];
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
      return this.#queryExecutor.createQueryReader(
        { ctes, ecsql },
        { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/classifications` },
      );
    }).pipe(
      map((row) => {
        return {
          id: row.id,
          tableId: row.tableId,
          parentId: row.parentId,
          relatedCategories2d: row.relatedCategories2d ? (row.relatedCategories2d as string).split(",") : [],
          relatedCategories3d: row.relatedCategories3d ? (row.relatedCategories3d as string).split(",") : [],
        };
      }),
    );
  }

  private getClassificationsInfo() {
    this.#classificationInfos ??= this.queryClassifications().pipe(
      reduce((acc, { id, tableId, parentId, relatedCategories2d, relatedCategories3d }) => {
        const tableOrParentId = tableId ?? parentId;
        let parentInfo = acc.get(tableOrParentId);
        if (!parentInfo) {
          parentInfo = { childClassificationIds: [], relatedCategories2d: [], relatedCategories3d: [], parentClassificationOrTableId: undefined };
          acc.set(tableOrParentId, parentInfo);
        }
        parentInfo.childClassificationIds.push(id);
        let classificationEntry = acc.get(id);
        if (!classificationEntry) {
          classificationEntry = { childClassificationIds: [], relatedCategories2d, relatedCategories3d, parentClassificationOrTableId: tableOrParentId };
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

  public getAllContainedCategories(classificationOrTableIds: Id64Arg): Observable<{ drawing: Id64Array; spatial: Id64Array }> {
    const result = { drawing: new Array<CategoryId>(), spatial: new Array<CategoryId>() };
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
              acc.drawing.push(...classificationInfo.relatedCategories2d);
              acc.spatial.push(...classificationInfo.relatedCategories3d);
              acc.childClassifications.push(...classificationInfo.childClassificationIds);
              return acc;
            },
            { drawing: new Array<Id64String>(), spatial: new Array<Id64String>(), childClassifications: new Array<Id64String>() },
          ),
          mergeMap(({ drawing, spatial, childClassifications }) => {
            if (childClassifications.length === 0) {
              return of({ drawing, spatial });
            }
            return this.getAllContainedCategories(childClassifications).pipe(
              map((childResult) => {
                drawing.push(...childResult.drawing);
                spatial.push(...childResult.spatial);
                return { drawing, spatial };
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
              acc.push(...classificationInfo.childClassificationIds);
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

  private queryFilteredElementsData({ element2dIds, element3dIds }: { element2dIds: Id64Arg; element3dIds: Id64Arg }): Observable<{
    modelId: Id64String;
    id: ElementId;
    categoryId: Id64String;
  }> {
    return defer(() => {
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
      return this.#queryExecutor.createQueryReader(
        { ecsql: queries.join(" UNION ALL ") },
        {
          rowFormat: "ECSqlPropertyNames",
          limit: "unbounded",
          restartToken: `${this.#componentName}/${this.#componentId}/filtered-elements/${Guid.createValue()}`,
        },
      );
    }).pipe(
      map((row) => {
        return { modelId: row.modelId, id: row.id, categoryId: row.categoryId };
      }),
    );
  }

  public getFilteredElementsData({
    element2dIds,
    element3dIds,
  }: {
    element2dIds: Id64Arg;
    element3dIds: Id64Arg;
  }): Observable<Map<ElementId, { categoryId: Id64String; modelId: Id64String }>> {
    const result = new Map<ElementId, { categoryId: Id64String; modelId: Id64String }>();
    if (Id64.sizeOf(element2dIds) === 0 && Id64.sizeOf(element3dIds) === 0) {
      return of(result);
    }
    this.#filteredElementsData ??= this.queryFilteredElementsData({
      element2dIds,
      element3dIds,
    }).pipe(
      reduce((acc, { modelId, id, categoryId }) => {
        acc.set(id, { modelId, categoryId });
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
