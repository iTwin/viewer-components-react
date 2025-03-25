/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { ModelCategoryElementsCountCache } from "../../common/internal/ModelCategoryElementsCountCache.js";
import { DEFINITION_CONTAINER_CLASS, SUB_CATEGORY_CLASS } from "./ClassNameDefinitions.js";

import type { Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { InstanceKey } from "@itwin/presentation-shared";

interface DefinitionContainerInfo {
  modelId: Id64String;
  parentDefinitionContainerExists: boolean;
  childCategories: CategoryInfo[];
  childDefinitionContainers: Id64Array;
}

interface CategoriesInfo {
  childCategories: CategoryInfo[];
  parentDefinitionContainerExists: boolean;
}

interface CategoryInfo {
  id: Id64String;
  subCategoryChildCount: number;
}

interface SubCategoryInfo {
  categoryId: Id64String;
}

/** @internal */
export class CategoriesTreeIdsCache {
  private _definitionContainersInfo: Promise<Map<Id64String, DefinitionContainerInfo>> | undefined;
  private _modelsCategoriesInfo: Promise<Map<Id64String, CategoriesInfo>> | undefined;
  private _elementModelsCategories: Promise<Map<Id64String, { categories: Id64Set; isSubModel: boolean; isModelPrivate: boolean }>> | undefined;
  private _subCategoriesInfo: Promise<Map<Id64String, SubCategoryInfo>> | undefined;
  private readonly _categoryElementCounts: ModelCategoryElementsCountCache;
  private _modelWithCategoryModeledElements: Promise<Map<string, Id64Set>> | undefined;
  private _categoryClass: string;
  private _categoryElementClass: string;
  private _isDefinitionContainerSupported: Promise<boolean> | undefined;
  private _filteredElementsModels: Promise<Map<Id64String, Id64String>> | undefined;

  constructor(
    private _queryExecutor: LimitingECSqlQueryExecutor,
    viewType: "3d" | "2d",
  ) {
    const { categoryClass, categoryElementClass } = getClassesByView(viewType);
    this._categoryClass = categoryClass;
    this._categoryElementClass = categoryElementClass;
    this._categoryElementCounts = new ModelCategoryElementsCountCache(_queryExecutor, categoryElementClass);
  }

  public [Symbol.dispose]() {
    this._filteredElementsModels = undefined;
  }

  private async *queryFilteredElementsModels(filteredElements: Id64Array): AsyncIterableIterator<{
    modelId: Id64String;
    id: Id64String;
  }> {
    const query = `
      SELECT Model.Id modelId, ECInstanceId id
      FROM ${this._categoryElementClass}
      WHERE ECInstanceId IN (${filteredElements.join(", ")})
    `;
    for await (const row of this._queryExecutor.createQueryReader({ ecsql: query }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { modelId: row.modelId, id: row.id };
    }
  }

  public async getFilteredElementsModels(filteredElements: Id64Array) {
    if (filteredElements.length === 0) {
      return new Map<Id64String, Id64String>();
    }

    this._filteredElementsModels ??= (async () => {
      const filteredElementsModels = new Map();
      for await (const { modelId, id } of this.queryFilteredElementsModels(filteredElements)) {
        filteredElementsModels.set(id, modelId);
      }
      return filteredElementsModels;
    })();
    return this._filteredElementsModels;
  }

  public clearFilteredElementsModels() {
    this._filteredElementsModels = undefined;
  }

  private async *queryElementModelCategories() {
    const query = `
      SELECT this.Model.Id modelId, this.Category.Id categoryId, m.IsPrivate isModelPrivate
      FROM BisCore.Model m
      JOIN ${this._categoryElementClass} this ON m.ECInstanceId = this.Model.Id
      WHERE this.Parent.Id IS NULL
      GROUP BY modelId, categoryId, isModelPrivate
    `;
    for await (const row of this._queryExecutor.createQueryReader(
      { ecsql: query },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: "tree-widget/categories-tree/element-models-and-categories-query" },
    )) {
      yield { modelId: row.modelId, categoryId: row.categoryId, isModelPrivate: !!row.isModelPrivate };
    }
  }

  private async *queryCategories(): AsyncIterableIterator<{
    id: Id64String;
    modelId: Id64String;
    parentDefinitionContainerExists: boolean;
    childCount: number;
  }> {
    const isDefinitionContainerSupported = await this.getIsDefinitionContainerSupported();
    const categoriesQuery = `
      SELECT
        this.ECInstanceId id,
        COUNT(sc.ECInstanceId) childCount,
        this.Model.Id modelId,
        ${
          isDefinitionContainerSupported
            ? `
            IIF(this.Model.Id IN (SELECT dc.ECInstanceId FROM ${DEFINITION_CONTAINER_CLASS} dc),
              true,
              false
            )`
            : "false"
        } parentDefinitionContainerExists
      FROM
        ${this._categoryClass} this
        JOIN ${SUB_CATEGORY_CLASS} sc ON sc.Parent.Id = this.ECInstanceId
        JOIN BisCore.Model m ON m.ECInstanceId = this.Model.Id
      WHERE
        NOT this.IsPrivate
        AND (NOT m.IsPrivate OR m.ECClassId IS (BisCore.DictionaryModel))
        AND EXISTS (SELECT 1 FROM ${this._categoryElementClass} e WHERE e.Category.Id = this.ECInstanceId)
      GROUP BY this.ECInstanceId
    `;
    for await (const row of this._queryExecutor.createQueryReader(
      { ecsql: categoriesQuery },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: "tree-widget/categories-tree/root-categories-query" },
    )) {
      yield { id: row.id, modelId: row.modelId, parentDefinitionContainerExists: row.parentDefinitionContainerExists, childCount: row.childCount };
    }
  }

  private async queryIsDefinitionContainersSupported(): Promise<boolean> {
    const query = `
      SELECT
        1
      FROM
        ECDbMeta.ECSchemaDef s
        JOIN ECDbMeta.ECClassDef c ON c.Schema.Id = s.ECInstanceId
      WHERE
        s.Name = 'BisCore'
        AND c.Name = 'DefinitionContainer'
    `;

    for await (const _row of this._queryExecutor.createQueryReader(
      { ecsql: query },
      { restartToken: "tree-widget/categories-tree/is-definition-container-supported-query" },
    )) {
      return true;
    }
    return false;
  }

  private async *queryDefinitionContainers(): AsyncIterableIterator<{ id: Id64String; modelId: Id64String }> {
    // DefinitionModel ECInstanceId will always be the same as modeled DefinitionContainer ECInstanceId, if this wasn't the case, we would need to do something like:
    //  JOIN BisCore.DefinitionModel dm ON dm.ECInstanceId = ${modelIdAccessor}
    //  JOIN BisCore.DefinitionModelBreaksDownDefinitionContainer dr ON dr.SourceECInstanceId = dm.ECInstanceId
    //  JOIN BisCore.DefinitionContainer dc ON dc.ECInstanceId = dr.TargetECInstanceId
    const DEFINITION_CONTAINERS_CTE = "DefinitionContainers";
    const ctes = [
      `
        ${DEFINITION_CONTAINERS_CTE}(ECInstanceId, ModelId) AS (
          SELECT
            dc.ECInstanceId,
            dc.Model.Id
          FROM
            ${DEFINITION_CONTAINER_CLASS} dc
          WHERE
            dc.ECInstanceId IN (SELECT c.Model.Id FROM ${this._categoryClass} c WHERE NOT c.IsPrivate AND EXISTS (SELECT 1 FROM ${this._categoryElementClass} e WHERE e.Category.Id = c.ECInstanceId))
            AND NOT dc.IsPrivate

          UNION ALL

          SELECT
            pdc.ECInstanceId,
            pdc.Model.Id
          FROM
            ${DEFINITION_CONTAINERS_CTE} cdc
            JOIN ${DEFINITION_CONTAINER_CLASS} pdc ON pdc.ECInstanceId = cdc.ModelId
          WHERE
            NOT pdc.IsPrivate
        )
      `,
    ];
    const definitionsQuery = `
      SELECT dc.ECInstanceId id, dc.ModelId modelId FROM ${DEFINITION_CONTAINERS_CTE} dc GROUP BY dc.ECInstanceId
    `;
    for await (const row of this._queryExecutor.createQueryReader(
      { ctes, ecsql: definitionsQuery },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: "tree-widget/categories-tree/definition-containers-query" },
    )) {
      yield { id: row.id, modelId: row.modelId };
    }
  }

  private async *queryVisibleSubCategories(categoriesInfo: Id64Array): AsyncIterableIterator<{ id: Id64String; parentId: Id64String }> {
    const definitionsQuery = `
      SELECT
        sc.ECInstanceId id,
        sc.Parent.Id categoryId
      FROM
        ${SUB_CATEGORY_CLASS} sc
      WHERE
        NOT sc.IsPrivate
        AND sc.Parent.Id IN (${categoriesInfo.join(",")})
    `;
    for await (const row of this._queryExecutor.createQueryReader(
      { ecsql: definitionsQuery },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: "tree-widget/categories-tree/sub-categories-query" },
    )) {
      yield { id: row.id, parentId: row.categoryId };
    }
  }

  private async getModelsCategoriesInfo() {
    this._modelsCategoriesInfo ??= (async () => {
      const allModelsCategories = new Map<Id64String, CategoriesInfo>();
      for await (const queriedCategory of this.queryCategories()) {
        let modelCategories = allModelsCategories.get(queriedCategory.modelId);
        if (modelCategories === undefined) {
          modelCategories = { parentDefinitionContainerExists: queriedCategory.parentDefinitionContainerExists, childCategories: [] };
          allModelsCategories.set(queriedCategory.modelId, modelCategories);
        }
        modelCategories.childCategories.push({ id: queriedCategory.id, subCategoryChildCount: queriedCategory.childCount });
      }
      return allModelsCategories;
    })();
    return this._modelsCategoriesInfo;
  }

  private async getElementModelsCategories() {
    this._elementModelsCategories ??= (async () => {
      const [modelCategories, modelWithCategoryModeledElements] = await Promise.all([
        (async () => {
          const elementModelsCategories = new Map<Id64String, { categories: Id64Set, isModelPrivate: boolean}>();
          for await (const queriedCategory of this.queryElementModelCategories()) {
            let modelEntry = elementModelsCategories.get(queriedCategory.modelId);
            if (modelEntry === undefined) {
              modelEntry = { categories: new Set(), isModelPrivate: queriedCategory.isModelPrivate};
              elementModelsCategories.set(queriedCategory.modelId, modelEntry);
            }
            modelEntry.categories.add(queriedCategory.categoryId);
          }
          return elementModelsCategories;
        })(),
        this.getModelWithCategoryModeledElements(),
      ]);
      const result = new Map<Id64String, { categories: Id64Set; isSubModel: boolean, isModelPrivate: boolean }>();
      for (const [modelId, modelEntry] of modelCategories) {
        const subModels = [...modelWithCategoryModeledElements.values()].reduce((acc, modeledElements) => {
          modeledElements.forEach((modeledElement) => acc.add(modeledElement));
          return acc;
        }, new Set<Id64String>());
        const isSubModel = subModels.has(modelId);
        result.set(modelId, { categories: modelEntry.categories, isSubModel, isModelPrivate: modelEntry.isModelPrivate });
      }
      return result;
    })();
    return this._elementModelsCategories;
  }

  private async *queryModeledElements() {
    const query = `
      SELECT
        pe.ECInstanceId modeledElementId,
        pe.Category.Id categoryId,
        pe.Model.Id modelId
      FROM BisCore.Model m
      JOIN ${this._categoryElementClass} pe ON pe.ECInstanceId = m.ModeledElement.Id
      WHERE
        m.IsPrivate = false
        AND m.ECInstanceId IN (SELECT Model.Id FROM ${this._categoryElementClass})
    `;
    for await (const row of this._queryExecutor.createQueryReader(
      { ecsql: query },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: "tree-widget/categories-tree/modeled-elements-query" },
    )) {
      yield { modelId: row.modelId, categoryId: row.categoryId, modeledElementId: row.modeledElementId, rootCategoryId: row.rootCategoryId };
    }
  }

  private async getModelWithCategoryModeledElements() {
    this._modelWithCategoryModeledElements ??= (async () => {
      const modelWithCategoryModeledElements = new Map<Id64String, Id64Set>();
      for await (const { modelId, categoryId, modeledElementId } of this.queryModeledElements()) {
        const key = `${modelId}-${categoryId}`;
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
    const result = new Array<Id64String>();
    for (const categoryId of categoryIds) {
      const entry = modelWithCategoryModeledElements.get(`${modelId}-${categoryId}`);
      if (entry !== undefined) {
        result.push(...entry);
      }
    }
    return result;
  }

  private async getSubCategoriesInfo() {
    this._subCategoriesInfo ??= (async () => {
      const allSubCategories = new Map<Id64String, SubCategoryInfo>();
      const modelsCategoriesInfo = await this.getModelsCategoriesInfo();
      const categoriesWithMoreThanOneSubCategory = new Array<Id64String>();
      for (const modelCategoriesInfo of modelsCategoriesInfo.values()) {
        categoriesWithMoreThanOneSubCategory.push(
          ...modelCategoriesInfo.childCategories.filter((categoryInfo) => categoryInfo.subCategoryChildCount > 1).map((categoryInfo) => categoryInfo.id),
        );
      }

      if (categoriesWithMoreThanOneSubCategory.length === 0) {
        return allSubCategories;
      }

      for await (const queriedSubCategory of this.queryVisibleSubCategories(categoriesWithMoreThanOneSubCategory)) {
        allSubCategories.set(queriedSubCategory.id, { categoryId: queriedSubCategory.parentId });
      }
      return allSubCategories;
    })();
    return this._subCategoriesInfo;
  }

  private async getDefinitionContainersInfo() {
    this._definitionContainersInfo ??= (async () => {
      const definitionContainersInfo = new Map<Id64String, DefinitionContainerInfo>();
      const [isDefinitionContainerSupported, modelsCategoriesInfo] = await Promise.all([
        this.getIsDefinitionContainerSupported(),
        this.getModelsCategoriesInfo(),
      ]);
      if (!isDefinitionContainerSupported || modelsCategoriesInfo.size === 0) {
        return definitionContainersInfo;
      }

      for await (const queriedDefinitionContainer of this.queryDefinitionContainers()) {
        const modelCategoriesInfo = modelsCategoriesInfo.get(queriedDefinitionContainer.id);

        definitionContainersInfo.set(queriedDefinitionContainer.id, {
          childCategories: modelCategoriesInfo?.childCategories ?? [],
          modelId: queriedDefinitionContainer.modelId,
          childDefinitionContainers: [],
          parentDefinitionContainerExists: false,
        });
      }

      for (const [definitionContainerId, definitionContainerInfo] of definitionContainersInfo) {
        const parentDefinitionContainer = definitionContainersInfo.get(definitionContainerInfo.modelId);
        if (parentDefinitionContainer !== undefined) {
          parentDefinitionContainer.childDefinitionContainers.push(definitionContainerId);
          definitionContainerInfo.parentDefinitionContainerExists = true;
        }
      }

      return definitionContainersInfo;
    })();
    return this._definitionContainersInfo;
  }

  public async getDirectChildDefinitionContainersAndCategories(
    parentDefinitionContainerIds: Id64Array,
  ): Promise<{ categories: CategoryInfo[]; definitionContainers: Id64Array }> {
    const definitionContainersInfo = await this.getDefinitionContainersInfo();

    const result = { definitionContainers: new Array<Id64String>(), categories: new Array<CategoryInfo>() };

    parentDefinitionContainerIds.forEach((parentDefinitionContainerId) => {
      const parentDefinitionContainerInfo = definitionContainersInfo.get(parentDefinitionContainerId);
      if (parentDefinitionContainerInfo !== undefined) {
        result.definitionContainers.push(...parentDefinitionContainerInfo.childDefinitionContainers);
        result.categories.push(...parentDefinitionContainerInfo.childCategories);
      }
    });
    return result;
  }

  public async getCategoriesElementModels(categoryIds: Id64Array, includeSubModels?: boolean): Promise<Map<Id64String, Id64Array>> {
    const elementModelsCategories = await this.getElementModelsCategories();
    const result = new Map<Id64String, Id64Array>();
    for (const categoryId of categoryIds) {
      for (const [modelId, { categories, isSubModel }] of elementModelsCategories) {
        if ((includeSubModels || !isSubModel) && categories.has(categoryId)) {
          let categoryModels = result.get(categoryId);
          if (!categoryModels) {
            categoryModels = new Array<Id64String>();
            result.set(categoryId, categoryModels);
          }
          categoryModels.push(modelId);
        }
      }
    }
    return result;
  }

  public async getModelCategories(modelId: Id64String): Promise<Id64Array> {
    const elementModelsCategories = await this.getElementModelsCategories();
    return [...(elementModelsCategories.get(modelId)?.categories ?? [])];
  }

  public async hasSubModel(elementId: Id64String): Promise<boolean> {
    const elementModelsCategories = await this.getElementModelsCategories();
    const modeledElementInfo = elementModelsCategories.get(elementId);
    if (!modeledElementInfo) {
      return false;
    }
    return !modeledElementInfo.isModelPrivate;
  }

  public async getAllContainedCategories(definitionContainerIds: Id64Array): Promise<Id64Array> {
    const result = new Array<Id64String>();

    const definitionContainersInfo = await this.getDefinitionContainersInfo();
    const indirectCategories = await Promise.all(
      definitionContainerIds.map(async (definitionContainerId) => {
        const definitionContainerInfo = definitionContainersInfo.get(definitionContainerId);
        if (definitionContainerInfo === undefined) {
          return [];
        }
        result.push(...definitionContainerInfo.childCategories.map((category) => category.id));
        return this.getAllContainedCategories(definitionContainerInfo.childDefinitionContainers);
      }),
    );
    for (const categories of indirectCategories) {
      result.push(...categories);
    }

    return result;
  }

  public async getInstanceKeyPaths(
    props: { categoryId: Id64String } | { definitionContainerId: Id64String } | { subCategoryId: Id64String },
  ): Promise<InstanceKey[]> {
    if ("subCategoryId" in props) {
      const subCategoriesInfo = await this.getSubCategoriesInfo();
      const subCategoryInfo = subCategoriesInfo.get(props.subCategoryId);
      if (subCategoryInfo === undefined) {
        return [];
      }
      return [...(await this.getInstanceKeyPaths({ categoryId: subCategoryInfo.categoryId })), { id: props.subCategoryId, className: SUB_CATEGORY_CLASS }];
    }

    if ("categoryId" in props) {
      const modelsCategoriesInfo = await this.getModelsCategoriesInfo();
      for (const [modelId, modelCategoriesInfo] of modelsCategoriesInfo) {
        if (modelCategoriesInfo.childCategories.find((childCategory) => childCategory.id === props.categoryId)) {
          if (!modelCategoriesInfo.parentDefinitionContainerExists) {
            return [{ id: props.categoryId, className: this._categoryClass }];
          }

          return [...(await this.getInstanceKeyPaths({ definitionContainerId: modelId })), { id: props.categoryId, className: this._categoryClass }];
        }
      }
      return [];
    }

    const definitionContainersInfo = await this.getDefinitionContainersInfo();
    const definitionContainerInfo = definitionContainersInfo.get(props.definitionContainerId);
    if (definitionContainerInfo === undefined) {
      return [];
    }

    if (!definitionContainerInfo.parentDefinitionContainerExists) {
      return [{ id: props.definitionContainerId, className: DEFINITION_CONTAINER_CLASS }];
    }

    return [
      ...(await this.getInstanceKeyPaths({ definitionContainerId: definitionContainerInfo.modelId })),
      { id: props.definitionContainerId, className: DEFINITION_CONTAINER_CLASS },
    ];
  }

  public async getCategoryElementsCount(modelId: Id64String, categoryId: Id64String): Promise<number> {
    return this._categoryElementCounts.getCategoryElementsCount(modelId, categoryId);
  }

  public async getAllDefinitionContainersAndCategories(): Promise<{ categories: Id64Array; definitionContainers: Id64Array }> {
    const [modelsCategoriesInfo, definitionContainersInfo] = await Promise.all([this.getModelsCategoriesInfo(), this.getDefinitionContainersInfo()]);
    const result = { definitionContainers: [...definitionContainersInfo.keys()], categories: new Array<Id64String>() };
    for (const modelCategoriesInfo of modelsCategoriesInfo.values()) {
      result.categories.push(...modelCategoriesInfo.childCategories.map((childCategory) => childCategory.id));
    }

    return result;
  }

  public async getRootDefinitionContainersAndCategories(): Promise<{ categories: CategoryInfo[]; definitionContainers: Id64Array }> {
    const [modelsCategoriesInfo, definitionContainersInfo] = await Promise.all([this.getModelsCategoriesInfo(), this.getDefinitionContainersInfo()]);
    const result = { definitionContainers: new Array<Id64String>(), categories: new Array<CategoryInfo>() };
    for (const modelCategoriesInfo of modelsCategoriesInfo.values()) {
      if (!modelCategoriesInfo.parentDefinitionContainerExists) {
        result.categories.push(...modelCategoriesInfo.childCategories);
      }
    }

    for (const [definitionContainerId, definitionContainerInfo] of definitionContainersInfo) {
      if (!definitionContainerInfo.parentDefinitionContainerExists) {
        result.definitionContainers.push(definitionContainerId);
      }
    }
    return result;
  }

  public async getSubCategories(categoryIds: Id64Array): Promise<Map<Id64String, Id64Array>> {
    const subCategoriesInfo = await this.getSubCategoriesInfo();
    const result = new Map<Id64String, Id64Array>();
    for (const categoryId of categoryIds) {
      for (const [subCategoryId, subCategoryInfo] of subCategoriesInfo) {
        if (subCategoryInfo.categoryId === categoryId) {
          let categoryEntry = result.get(categoryId);
          if (!categoryEntry) {
            categoryEntry = [];
            result.set(categoryId, categoryEntry);
          }
          categoryEntry.push(subCategoryId);
        }
      }
    }

    return result;
  }

  public async getIsDefinitionContainerSupported(): Promise<boolean> {
    this._isDefinitionContainerSupported ??= this.queryIsDefinitionContainersSupported();
    return this._isDefinitionContainerSupported;
  }
}

/** @internal */
export function getClassesByView(viewType: "2d" | "3d") {
  return viewType === "2d"
    ? { categoryClass: "BisCore.DrawingCategory", categoryElementClass: "BisCore.GeometricElement2d" }
    : { categoryClass: "BisCore.SpatialCategory", categoryElementClass: "BisCore.GeometricElement3d" };
}
