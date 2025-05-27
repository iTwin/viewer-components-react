/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import {
  CLASS_NAME_Classification,
  CLASS_NAME_ClassificationSystem,
  CLASS_NAME_ClassificationTable,
  CLASS_NAME_ElementHasClassifications,
  CLASS_NAME_GeometricElement2d,
  CLASS_NAME_GeometricElement3d,
} from "../../common/internal/ClassNameDefinitions.js";
import { ModelCategoryElementsCountCache } from "../../common/internal/ModelCategoryElementsCountCache.js";
import { getDistinctMapValues } from "../../common/internal/Utils.js";

import type { Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { CategoryId, ElementId, ModelId } from "../../common/internal/Types.js";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { ClassificationsTreeHierarchyConfiguration } from "../ClassificationsTreeDefinition.js";

type ClassificationId = Id64String;
type ClassificationTableId = Id64String;

/** @internal */
export interface CategoryInfo {
  id: CategoryId;
}

interface ClassificationInfo {
  childClassificationIds: ClassificationId[];
  relatedCategories: CategoryInfo[];
}

type ModelCategoryKey = `${ModelId}-${CategoryId}`;

/** @internal */
export class ClassificationsTreeIdsCache implements Disposable {
  private readonly _categoryElementCounts: ModelCategoryElementsCountCache;
  private _elementModelsCategories: Promise<Map<ModelId, { categoryIds: Id64Set; isSubModel: boolean }>> | undefined;
  private _modelWithCategoryModeledElements: Promise<Map<ModelCategoryKey, Set<ElementId>>> | undefined;
  private _classificationInfos: Promise<Map<ClassificationId | ClassificationTableId, ClassificationInfo>> | undefined;

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
  }> {
    const query = `
      SELECT * FROM (
        SELECT this.Model.Id modelId, this.Category.Id categoryId
        FROM BisCore.GeometricModel m
        JOIN BisCore.GeometricElement3d this ON m.ECInstanceId = this.Model.Id
        WHERE this.Parent.Id IS NULL AND m.IsPrivate = false
        GROUP BY modelId, categoryId
      )
      UNION ALL
      SELECT * FROM (
        SELECT this.Model.Id modelId, this.Category.Id categoryId
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
      yield { modelId: row.modelId, categoryId: row.categoryId };
    }
  }

  private async getElementModelsCategories() {
    this._elementModelsCategories ??= (async () => {
      const [modelCategories, modelWithCategoryModeledElements] = await Promise.all([
        (async () => {
          const elementModelsCategories = new Map<ModelId, { categoryIds: Id64Set }>();
          for await (const queriedCategory of this.queryElementModelCategories()) {
            let modelEntry = elementModelsCategories.get(queriedCategory.modelId);
            if (modelEntry === undefined) {
              modelEntry = { categoryIds: new Set() };
              elementModelsCategories.set(queriedCategory.modelId, modelEntry);
            }
            modelEntry.categoryIds.add(queriedCategory.categoryId);
          }
          return elementModelsCategories;
        })(),
        this.getModelWithCategoryModeledElements(),
      ]);
      const result = new Map<ModelId, { categoryIds: Set<CategoryId>; isSubModel: boolean }>();
      const subModels = getDistinctMapValues(modelWithCategoryModeledElements);
      for (const [modelId, modelEntry] of modelCategories) {
        const isSubModel = subModels.has(modelId);
        result.set(modelId, { categoryIds: modelEntry.categoryIds, isSubModel });
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

  public async getCategoriesModeledElements(modelId: Id64String, categoryIds: Id64Array): Promise<Id64Array> {
    const modelWithCategoryModeledElements = await this.getModelWithCategoryModeledElements();
    const result = new Array<ElementId>();
    for (const categoryId of categoryIds) {
      const entry = modelWithCategoryModeledElements.get(`${modelId}-${categoryId}`);
      if (entry !== undefined) {
        result.push(...entry);
      }
    }
    return result;
  }

  public async getCategoriesElementModels(categoryIds: Id64Array, includeSubModels?: boolean): Promise<Map<CategoryId, Array<ModelId>>> {
    const elementModelsCategories = await this.getElementModelsCategories();
    const result = new Map<CategoryId, Array<ModelId>>();
    for (const categoryId of categoryIds) {
      for (const [modelId, { categoryIds: categories, isSubModel }] of elementModelsCategories) {
        if ((includeSubModels || !isSubModel) && categories.has(categoryId)) {
          let categoryModels = result.get(categoryId);
          if (!categoryModels) {
            categoryModels = new Array<ModelId>();
            result.set(categoryId, categoryModels);
          }
          categoryModels.push(modelId);
        }
      }
    }
    return result;
  }

  public async getModelCategoryIds(modelId: Id64String): Promise<Id64Array> {
    const elementModelsCategories = await this.getElementModelsCategories();
    return [...(elementModelsCategories.get(modelId)?.categoryIds ?? [])];
  }

  public async hasSubModel(elementId: Id64String): Promise<boolean> {
    const elementModelsCategories = await this.getElementModelsCategories();
    return elementModelsCategories.has(elementId);
  }

  public async getCategoryElementsCount(modelId: Id64String, categoryId: Id64String): Promise<number> {
    return this._categoryElementCounts.getCategoryElementsCount(modelId, categoryId);
  }

  private async *queryClassifications(): AsyncIterableIterator<{
    id: Id64String;
    tableId?: ClassificationTableId;
    parentId?: ClassificationId;
    relatedCategories: CategoryId[];
  }> {
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
    const ecsql = this._hierarchyConfig.categorySymbolizesClassificationRelationshipName
      ? `
          SELECT
            cl.ClassificationId id,
            cl.ClassificationTableId tableId,
            cl.ParentClassificationId parentId,
            group_concat(IdToHex(csc.SourceECInstanceId)) relatedCategories
          FROM ${CLASSIFICATIONS_CTE} cl
          LEFT JOIN ${this._hierarchyConfig.categorySymbolizesClassificationRelationshipName} csc ON csc.TargetECInstanceId = cl.ClassificationId
          GROUP BY cl.ClassificationId
        `
      : `
          SELECT
            cl.ClassificationId id,
            cl.ClassificationTableId tableId,
            cl.ParentClassificationId parentId,
            group_concat(IdToHex(cat.ECInstanceId)) relatedCategories
          FROM ${CLASSIFICATIONS_CTE} cl
          LEFT JOIN ${CLASS_NAME_ElementHasClassifications} ehc ON ehc.TargetECInstanceId = cl.ClassificationId
          LEFT JOIN (
            SELECT ECInstanceId, Category.Id CategoryId FROM ${CLASS_NAME_GeometricElement2d} WHERE Parent.Id IS NULL
            UNION ALL
            SELECT ECInstanceId, Category.Id CategoryId FROM ${CLASS_NAME_GeometricElement3d} WHERE Parent.Id IS NULL
          ) e ON e.ECInstanceId = ehc.SourceECInstanceId
          LEFT JOIN BisCore.Category cat ON cat.ECInstanceId = e.CategoryId AND NOT cat.IsPrivate
          GROUP BY cl.ClassificationId
        `;
    for await (const row of this._queryExecutor.createQueryReader(
      { ctes, ecsql },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: "tree-widget/classifications-tree/classifications-query" },
    )) {
      yield {
        id: row.id,
        tableId: row.tableId,
        parentId: row.parentId,
        relatedCategories: row.relatedCategories ? (row.relatedCategories as string).split(",") : [],
      };
    }
  }

  private async getClassificationsInfo() {
    this._classificationInfos ??= (async () => {
      const classificationInfos = new Map<ClassificationId | ClassificationTableId, ClassificationInfo>();
      for await (const { id, tableId, parentId, relatedCategories } of this.queryClassifications()) {
        const tableOrParentId = tableId ?? parentId;
        assert(!!tableOrParentId);
        let parentInfo = classificationInfos.get(tableOrParentId);
        if (!parentInfo) {
          parentInfo = { childClassificationIds: [], relatedCategories: [] };
          classificationInfos.set(tableOrParentId, parentInfo);
        }
        parentInfo.childClassificationIds.push(id);

        classificationInfos.set(id, { childClassificationIds: [], relatedCategories: relatedCategories.map((categoryId) => ({ id: categoryId })) });
      }
      return classificationInfos;
    })();
    return this._classificationInfos;
  }

  public async getAllContainedCategories(classificationOrTableIds: Id64Array): Promise<Id64Array> {
    const result = new Array<CategoryId>();
    const classificationsInfo = await this.getClassificationsInfo();
    await Promise.all(
      classificationOrTableIds.map(async (classificationOrTableId) => {
        const classificationInfo = classificationsInfo.get(classificationOrTableId);
        if (classificationInfo === undefined) {
          return;
        }
        result.push(...classificationInfo.relatedCategories.map((category) => category.id));
        result.push(...(await this.getAllContainedCategories(classificationInfo.childClassificationIds)));
      }),
    );
    return result;
  }

  public async getDirectCategoriesAndClassifications(
    classificationOrTableIds: Id64Array,
  ): Promise<{ classificationIds: ClassificationId[]; categoryIds: CategoryId[] }> {
    const result = { classificationIds: new Array<ClassificationId>(), categoryIds: new Array<CategoryId>() };
    const classificationsInfo = await this.getClassificationsInfo();
    await Promise.all(
      classificationOrTableIds.map(async (classificationOrTableId) => {
        const classificationInfo = classificationsInfo.get(classificationOrTableId);
        if (classificationInfo === undefined) {
          return;
        }
        result.classificationIds.push(...classificationInfo.childClassificationIds);
        result.categoryIds.push(...classificationInfo.relatedCategories.map((category) => category.id));
      }),
    );
    return result;
  }
}
