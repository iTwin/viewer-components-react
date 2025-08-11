/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Id64, Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import { CLASS_NAME_DefinitionContainer, CLASS_NAME_Model, CLASS_NAME_SubCategory } from "../../common/internal/ClassNameDefinitions.js";
import { ModelCategoryElementsCountCache } from "../../common/internal/ModelCategoryElementsCountCache.js";
import { getArrayFromId64Arg, getClassesByView, getDistinctMapValues } from "../../common/internal/Utils.js";

import type { CategoryId, DefinitionContainerId, ElementId, ModelId, SubCategoryId } from "../../common/internal/Types.js";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { InstanceKey } from "@itwin/presentation-shared";

interface DefinitionContainerInfo {
  modelId: Id64String;
  parentDefinitionContainerExists: boolean;
  childCategories: CategoryInfo[];
  childDefinitionContainerIds: Id64Array;
}

interface CategoriesInfo {
  childCategories: CategoryInfo[];
  parentDefinitionContainerExists: boolean;
}

/** @internal */
export interface CategoryInfo {
  id: CategoryId;
  subCategoryChildCount: number;
}

interface SubCategoryInfo {
  categoryId: Id64String;
}

type ModelCategoryKey = `${ModelId}-${CategoryId}`;

/** @internal */
export class CategoriesTreeIdsCache implements Disposable {
  private _definitionContainersInfo: Promise<Map<DefinitionContainerId, DefinitionContainerInfo>> | undefined;
  private _modelsCategoriesInfo: Promise<Map<ModelId, CategoriesInfo>> | undefined;
  private _elementModelsCategories: Promise<Map<ModelId, { categoryIds: Id64Set; isSubModel: boolean }>> | undefined;
  private _subCategoriesInfo: Promise<Map<SubCategoryId, SubCategoryInfo>> | undefined;
  private readonly _categoryElementCounts: ModelCategoryElementsCountCache;
  private _modelWithCategoryModeledElements: Promise<Map<ModelCategoryKey, Set<ElementId>>> | undefined;
  private _categoryClass: string;
  private _categoryElementClass: string;
  private _categoryModelClass: string;
  private _isDefinitionContainerSupported: Promise<boolean> | undefined;
  private _filteredElementsModels: Promise<Map<ElementId, ModelId>> | undefined;

  constructor(
    private _queryExecutor: LimitingECSqlQueryExecutor,
    viewType: "3d" | "2d",
  ) {
    const { categoryClass, elementClass, modelClass } = getClassesByView(viewType);
    this._categoryClass = categoryClass;
    this._categoryElementClass = elementClass;
    this._categoryModelClass = modelClass;
    this._categoryElementCounts = new ModelCategoryElementsCountCache(_queryExecutor, [elementClass]);
  }

  public [Symbol.dispose]() {
    this._categoryElementCounts[Symbol.dispose]();
  }

  private async *queryFilteredElementsModels(filteredElementIds: Id64Array): AsyncIterableIterator<{
    modelId: Id64String;
    id: ElementId;
  }> {
    const query = `
      SELECT Model.Id modelId, ECInstanceId id
      FROM ${this._categoryElementClass}
      WHERE ECInstanceId IN (${filteredElementIds.join(", ")})
    `;
    for await (const row of this._queryExecutor.createQueryReader({ ecsql: query }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { modelId: row.modelId, id: row.id };
    }
  }

  public async getFilteredElementsModels(filteredElementIds: Id64Arg) {
    if (Id64.sizeOf(filteredElementIds) === 0) {
      return new Map<ElementId, ModelId>();
    }

    this._filteredElementsModels ??= (async () => {
      const filteredElementsModels = new Map();
      for await (const { modelId, id } of this.queryFilteredElementsModels(getArrayFromId64Arg(filteredElementIds))) {
        filteredElementsModels.set(id, modelId);
      }
      return filteredElementsModels;
    })();
    return this._filteredElementsModels;
  }

  public clearFilteredElementsModels() {
    this._filteredElementsModels = undefined;
  }

  private async *queryElementModelCategories(): AsyncIterableIterator<{
    modelId: Id64String;
    categoryId: Id64String;
  }> {
    const query = `
      SELECT this.Model.Id modelId, this.Category.Id categoryId
      FROM ${this._categoryModelClass} m
      JOIN ${this._categoryElementClass} this ON m.ECInstanceId = this.Model.Id
      WHERE this.Parent.Id IS NULL AND m.IsPrivate = false
      GROUP BY modelId, categoryId
    `;
    for await (const row of this._queryExecutor.createQueryReader(
      { ecsql: query },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: "tree-widget/categories-tree/element-models-and-categories-query" },
    )) {
      yield { modelId: row.modelId, categoryId: row.categoryId };
    }
  }

  private async *queryCategories(): AsyncIterableIterator<{
    id: CategoryId;
    modelId: Id64String;
    parentDefinitionContainerExists: boolean;
    subCategoryChildCount: number;
  }> {
    const isDefinitionContainerSupported = await this.getIsDefinitionContainerSupported();
    const categoriesQuery = `
      SELECT
        this.ECInstanceId id,
        COUNT(sc.ECInstanceId) subCategoryChildCount,
        this.Model.Id modelId,
        ${
          isDefinitionContainerSupported
            ? `
            IIF(this.Model.Id IN (SELECT dc.ECInstanceId FROM ${CLASS_NAME_DefinitionContainer} dc),
              true,
              false
            )`
            : "false"
        } parentDefinitionContainerExists
      FROM
        ${this._categoryClass} this
        JOIN ${CLASS_NAME_SubCategory} sc ON sc.Parent.Id = this.ECInstanceId
        JOIN ${CLASS_NAME_Model} m ON m.ECInstanceId = this.Model.Id
      WHERE
        NOT this.IsPrivate
        AND (NOT m.IsPrivate OR m.ECClassId IS (BisCore.DictionaryModel))
        AND EXISTS (SELECT 1 FROM ${this._categoryElementClass} e WHERE e.Category.Id = this.ECInstanceId)
      GROUP BY this.ECInstanceId
    `;
    for await (const row of this._queryExecutor.createQueryReader(
      { ecsql: categoriesQuery },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: "tree-widget/categories-tree/categories-query" },
    )) {
      yield {
        id: row.id,
        modelId: row.modelId,
        parentDefinitionContainerExists: row.parentDefinitionContainerExists,
        subCategoryChildCount: row.subCategoryChildCount,
      };
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

  private async *queryDefinitionContainers(): AsyncIterableIterator<{ id: DefinitionContainerId; modelId: Id64String }> {
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
            ${CLASS_NAME_DefinitionContainer} dc
          WHERE
            dc.ECInstanceId IN (SELECT c.Model.Id FROM ${this._categoryClass} c WHERE NOT c.IsPrivate AND EXISTS (SELECT 1 FROM ${this._categoryElementClass} e WHERE e.Category.Id = c.ECInstanceId))
            AND NOT dc.IsPrivate

          UNION ALL

          SELECT
            pdc.ECInstanceId,
            pdc.Model.Id
          FROM
            ${DEFINITION_CONTAINERS_CTE} cdc
            JOIN ${CLASS_NAME_DefinitionContainer} pdc ON pdc.ECInstanceId = cdc.ModelId
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

  private async *queryVisibleSubCategories(categoryIds: Id64Array): AsyncIterableIterator<{ id: SubCategoryId; parentId: CategoryId }> {
    const definitionsQuery = `
      SELECT
        sc.ECInstanceId id,
        sc.Parent.Id categoryId
      FROM
        ${CLASS_NAME_SubCategory} sc
      WHERE
        NOT sc.IsPrivate
        AND sc.Parent.Id IN (${categoryIds.join(",")})
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
      const allModelsCategories = new Map<ModelId, CategoriesInfo>();
      for await (const queriedCategory of this.queryCategories()) {
        let modelCategories = allModelsCategories.get(queriedCategory.modelId);
        if (modelCategories === undefined) {
          modelCategories = { parentDefinitionContainerExists: queriedCategory.parentDefinitionContainerExists, childCategories: [] };
          allModelsCategories.set(queriedCategory.modelId, modelCategories);
        }
        modelCategories.childCategories.push({ id: queriedCategory.id, subCategoryChildCount: queriedCategory.subCategoryChildCount });
      }
      return allModelsCategories;
    })();
    return this._modelsCategoriesInfo;
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
      FROM ${this._categoryModelClass} m
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

  private async getSubCategoriesInfo() {
    this._subCategoriesInfo ??= (async () => {
      const allSubCategories = new Map<SubCategoryId, SubCategoryInfo>();
      const modelsCategoriesInfo = await this.getModelsCategoriesInfo();
      const categoriesWithMoreThanOneSubCategory = new Array<CategoryId>();
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
      const definitionContainersInfo = new Map<DefinitionContainerId, DefinitionContainerInfo>();
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
          childDefinitionContainerIds: [],
          parentDefinitionContainerExists: false,
        });
      }

      for (const [definitionContainerId, definitionContainerInfo] of definitionContainersInfo) {
        const parentDefinitionContainer = definitionContainersInfo.get(definitionContainerInfo.modelId);
        if (parentDefinitionContainer !== undefined) {
          parentDefinitionContainer.childDefinitionContainerIds.push(definitionContainerId);
          definitionContainerInfo.parentDefinitionContainerExists = true;
        }
      }

      return definitionContainersInfo;
    })();
    return this._definitionContainersInfo;
  }

  public async getDirectChildDefinitionContainersAndCategories(
    parentDefinitionContainerIds: Id64Arg,
  ): Promise<{ categories: CategoryInfo[]; definitionContainers: Array<DefinitionContainerId> }> {
    const definitionContainersInfo = await this.getDefinitionContainersInfo();

    const result = { definitionContainers: new Array<DefinitionContainerId>(), categories: new Array<CategoryInfo>() };
    for (const parentDefinitionContainerId of Id64.iterable(parentDefinitionContainerIds)) {
      const parentDefinitionContainerInfo = definitionContainersInfo.get(parentDefinitionContainerId);
      if (!parentDefinitionContainerInfo) {
        continue;
      }
      result.definitionContainers.push(...parentDefinitionContainerInfo.childDefinitionContainerIds);
      result.categories.push(...parentDefinitionContainerInfo.childCategories);
    }
    return result;
  }

  public async getCategoriesElementModels(categoryIds: Id64Arg, includeSubModels?: boolean): Promise<Map<CategoryId, Set<ModelId>>> {
    const elementModelsCategories = await this.getElementModelsCategories();
    const result = new Map<CategoryId, Set<ModelId>>();
    for (const categoryId of Id64.iterable(categoryIds)) {
      for (const [modelId, { categoryIds: categories, isSubModel }] of elementModelsCategories) {
        if ((includeSubModels || !isSubModel) && categories.has(categoryId)) {
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

  public async getModelCategoryIds(modelId: Id64String): Promise<Id64Array> {
    const elementModelsCategories = await this.getElementModelsCategories();
    return [...(elementModelsCategories.get(modelId)?.categoryIds ?? [])];
  }

  public async hasSubModel(elementId: Id64String): Promise<boolean> {
    const elementModelsCategories = await this.getElementModelsCategories();
    return elementModelsCategories.has(elementId);
  }

  public async getAllContainedCategories(definitionContainerIds: Id64Arg): Promise<Id64Array> {
    const result = new Array<CategoryId>();

    const definitionContainersInfo = await this.getDefinitionContainersInfo();
    const indirectCategoryPromises = new Array<Promise<Id64Array>>();
    for (const definitionContainerId of Id64.iterable(definitionContainerIds)) {
      const definitionContainerInfo = definitionContainersInfo.get(definitionContainerId);
      if (definitionContainerInfo === undefined) {
        continue;
      }
      result.push(...definitionContainerInfo.childCategories.map((category) => category.id));
      indirectCategoryPromises.push(this.getAllContainedCategories(definitionContainerInfo.childDefinitionContainerIds));
    }

    const indirectCategories = await Promise.all(indirectCategoryPromises);
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
      return [...(await this.getInstanceKeyPaths({ categoryId: subCategoryInfo.categoryId })), { id: props.subCategoryId, className: CLASS_NAME_SubCategory }];
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
      return [{ id: props.definitionContainerId, className: CLASS_NAME_DefinitionContainer }];
    }

    return [
      ...(await this.getInstanceKeyPaths({ definitionContainerId: definitionContainerInfo.modelId })),
      { id: props.definitionContainerId, className: CLASS_NAME_DefinitionContainer },
    ];
  }

  public async getCategoryElementsCount(modelId: Id64String, categoryId: Id64String): Promise<number> {
    return this._categoryElementCounts.getCategoryElementsCount(modelId, categoryId);
  }

  public async getAllDefinitionContainersAndCategories(): Promise<{ categories: Array<CategoryId>; definitionContainers: Array<DefinitionContainerId> }> {
    const [modelsCategoriesInfo, definitionContainersInfo] = await Promise.all([this.getModelsCategoriesInfo(), this.getDefinitionContainersInfo()]);
    const result = { definitionContainers: [...definitionContainersInfo.keys()], categories: new Array<Id64String>() };
    for (const modelCategoriesInfo of modelsCategoriesInfo.values()) {
      result.categories.push(...modelCategoriesInfo.childCategories.map((childCategory) => childCategory.id));
    }

    return result;
  }

  public async getRootDefinitionContainersAndCategories(): Promise<{ categories: CategoryInfo[]; definitionContainers: Array<DefinitionContainerId> }> {
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

  public async getSubCategories(categoryIds: Id64Arg): Promise<Map<CategoryId, Array<SubCategoryId>>> {
    const subCategoriesInfo = await this.getSubCategoriesInfo();
    const result = new Map<CategoryId, Array<SubCategoryId>>();
    for (const categoryId of Id64.iterable(categoryIds)) {
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
