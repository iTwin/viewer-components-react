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
import { ModelCategoryElementsCountCache } from "../../common/internal/ModelCategoryElementsCountCache.js";
import { getDistinctMapValues, joinId64Arg } from "../../common/internal/Utils.js";

import type { Observable } from "rxjs";
import type { Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { CategoryId, ElementId, ModelId } from "../../common/internal/Types.js";
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

type ModelCategoryKey = `${ModelId}-${CategoryId}`;

/** @internal */
export class ClassificationsTreeIdsCache implements Disposable {
  private readonly _categoryElementCounts: ModelCategoryElementsCountCache;
  private _elementModelsCategories: Promise<Map<ModelId, { category2dIds: Id64Set; category3dIds: Id64Set; isSubModel: boolean }>> | undefined;
  private _modelWithCategoryModeledElements: Promise<Map<ModelCategoryKey, Set<ElementId>>> | undefined;
  private _classificationInfos: Promise<Map<ClassificationId | ClassificationTableId, ClassificationInfo>> | undefined;
  private _filteredElementsData: Promise<Map<ElementId, { modelId: Id64String; categoryId: Id64String }>> | undefined;

  constructor(
    private _queryExecutor: LimitingECSqlQueryExecutor,
    private _hierarchyConfig: ClassificationsTreeHierarchyConfiguration,
  ) {
    this._categoryElementCounts = new ModelCategoryElementsCountCache(_queryExecutor, ["BisCore.GeometricElement2d", "BisCore.GeometricElement3d"]);
  }

  public [Symbol.dispose]() {
    this._categoryElementCounts[Symbol.dispose]();
  }

  private async *queryElementModelCategories(): AsyncIterableIterator<{
    modelId: Id64String;
    categoryId: Id64String;
    type: "2d" | "3d";
  }> {
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
    for await (const row of this._queryExecutor.createQueryReader(
      { ecsql: query },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: "tree-widget/classifications-tree/element-models-and-categories-query" },
    )) {
      yield { modelId: row.modelId, categoryId: row.categoryId, type: row.type };
    }
  }

  private async getElementModelsCategories() {
    this._elementModelsCategories ??= (async () => {
      const [modelCategories, modelWithCategoryModeledElements] = await Promise.all([
        (async () => {
          const elementModelsCategories = new Map<ModelId, { category2dIds: Id64Set; category3dIds: Id64Set }>();
          for await (const queriedCategory of this.queryElementModelCategories()) {
            let modelEntry = elementModelsCategories.get(queriedCategory.modelId);
            if (modelEntry === undefined) {
              modelEntry = { category2dIds: new Set(), category3dIds: new Set() };
              elementModelsCategories.set(queriedCategory.modelId, modelEntry);
            }
            switch (queriedCategory.type) {
              case "2d":
                modelEntry.category2dIds.add(queriedCategory.categoryId);
                break;
              case "3d":
                modelEntry.category3dIds.add(queriedCategory.categoryId);
                break;
            }
          }
          return elementModelsCategories;
        })(),
        this.getModelWithCategoryModeledElements(),
      ]);
      const result = new Map<ModelId, { category2dIds: Id64Set; category3dIds: Id64Set; isSubModel: boolean }>();
      const subModels = getDistinctMapValues(modelWithCategoryModeledElements);
      for (const [modelId, modelEntry] of modelCategories) {
        const isSubModel = subModels.has(modelId);
        result.set(modelId, { category2dIds: modelEntry.category2dIds, category3dIds: modelEntry.category3dIds, isSubModel });
      }
      return result;
    })();
    return this._elementModelsCategories;
  }

  private async *queryModeledElements(): AsyncIterableIterator<{
    modelId: Id64String;
    modeledElementId: Id64String;
    categoryId: Id64String;
    rootCategoryId: Id64String;
  }> {
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
    for await (const row of this._queryExecutor.createQueryReader(
      { ecsql: query },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: "tree-widget/classifications-tree/modeled-elements-query" },
    )) {
      yield { modelId: row.modelId, categoryId: row.categoryId, modeledElementId: row.modeledElementId, rootCategoryId: row.rootCategoryId };
    }
  }

  private async getModelWithCategoryModeledElements() {
    this._modelWithCategoryModeledElements ??= (async () => {
      const modelWithCategoryModeledElements = new Map<ModelCategoryKey, Set<ElementId>>();
      for await (const { modelId, categoryId, modeledElementId } of this.queryModeledElements()) {
        const key: ModelCategoryKey = `${modelId}-${categoryId}`;
        const entry = modelWithCategoryModeledElements.get(key);
        if (entry === undefined) {
          modelWithCategoryModeledElements.set(key, new Set([modeledElementId]));
        } else {
          entry.add(modeledElementId);
        }
      }
      return modelWithCategoryModeledElements;
    })();
    return this._modelWithCategoryModeledElements;
  }

  public async getCategoriesModeledElements(modelId: Id64String, categoryIds: Id64Arg): Promise<Id64Array> {
    const modelWithCategoryModeledElements = await this.getModelWithCategoryModeledElements();
    const result = new Array<ElementId>();
    for (const categoryId of Id64.iterable(categoryIds)) {
      const entry = modelWithCategoryModeledElements.get(`${modelId}-${categoryId}`);
      if (entry !== undefined) {
        result.push(...entry);
      }
    }
    return result;
  }

  public async getCategoriesElementModels(categoryIds: Id64Arg, includeSubModels?: boolean): Promise<Map<CategoryId, Set<ModelId>>> {
    const elementModelsCategories = await this.getElementModelsCategories();
    const result = new Map<CategoryId, Set<ModelId>>();
    for (const categoryId of Id64.iterable(categoryIds)) {
      for (const [modelId, { category2dIds, category3dIds, isSubModel }] of elementModelsCategories) {
        if ((includeSubModels || !isSubModel) && (category2dIds.has(categoryId) || category3dIds.has(categoryId))) {
          let categoryModels = result.get(categoryId);
          if (!categoryModels) {
            categoryModels = new Set<ModelId>();
            result.set(categoryId, categoryModels);
          }
          categoryModels.add(modelId);
        }
      }
    }
    return result;
  }

  public async getModelCategoryIds(modelId: Id64String): Promise<{ drawing: Id64Array; spatial: Id64Array }> {
    const elementModelsCategories = await this.getElementModelsCategories();
    return {
      drawing: Array.from(elementModelsCategories.get(modelId)?.category2dIds ?? []),
      spatial: Array.from(elementModelsCategories.get(modelId)?.category3dIds ?? []),
    };
  }

  public async hasSubModel(elementId: Id64String): Promise<boolean> {
    const elementModelsCategories = await this.getElementModelsCategories();
    return elementModelsCategories.has(elementId);
  }

  public async getCategoryElementsCount(modelId: Id64String, categoryId: Id64String): Promise<number> {
    return this._categoryElementCounts.getCategoryElementsCount(modelId, categoryId);
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
            cs.CodeValue = '${this._hierarchyConfig.rootClassificationSystemCode}'
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
    for await (const row of this._queryExecutor.createQueryReader(
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
    this._classificationInfos ??= (async () => {
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
    return this._classificationInfos;
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
    for await (const row of this._queryExecutor.createQueryReader(
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

    this._filteredElementsData ??= (async () => {
      const filteredElementsData = new Map();
      for await (const { modelId, id, categoryId } of this.queryFilteredElementsData({
        element2dIds,
        element3dIds,
      })) {
        filteredElementsData.set(id, { modelId, categoryId });
      }
      return filteredElementsData;
    })();
    return this._filteredElementsData;
  }

  public clearFilteredElementsData() {
    this._filteredElementsData = undefined;
  }
}
