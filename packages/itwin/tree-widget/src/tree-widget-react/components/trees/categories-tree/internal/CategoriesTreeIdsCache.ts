/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Guid, Id64 } from "@itwin/core-bentley";
import { CLASS_NAME_DefinitionContainer, CLASS_NAME_Model, CLASS_NAME_SubCategory } from "../../common/internal/ClassNameDefinitions.js";
import { ModelCategoryElementsCountCache } from "../../common/internal/ModelCategoryElementsCountCache.js";
import { getClassesByView, getDistinctMapValues, joinId64Arg } from "../../common/internal/Utils.js";

import type { GuidString, Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { CategoryId, DefinitionContainerId, ElementId, ModelId, SubCategoryId } from "../../common/internal/Types.js";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { InstanceKey } from "@itwin/presentation-shared";

interface DefinitionContainerInfo {
  modelId: Id64String;
  parentDefinitionContainerExists: boolean;
  childCategories: CategoryInfo[];
  childDefinitionContainers: Array<{ id: Id64String; hasElements: boolean }>;
  hasElements: boolean;
}

interface CategoriesInfo {
  childCategories: CategoryInfo[];
  parentDefinitionContainerExists: boolean;
}

/** @internal */
export interface CategoryInfo {
  id: CategoryId;
  subCategoryChildCount: number;
  hasElements: boolean;
}

interface SubCategoryInfo {
  categoryId: Id64String;
}

type ModelCategoryKey = `${ModelId}-${CategoryId}`;

/** @internal */
export class CategoriesTreeIdsCache implements Disposable {
  #definitionContainersInfo: Promise<Map<DefinitionContainerId, DefinitionContainerInfo>> | undefined;
  #modelsCategoriesInfo: Promise<Map<ModelId, CategoriesInfo>> | undefined;
  #elementModelsCategories: Promise<Map<ModelId, { categoryIds: Id64Set; isSubModel: boolean }>> | undefined;
  #subCategoriesInfo: Promise<Map<SubCategoryId, SubCategoryInfo>> | undefined;
  readonly #categoryElementCounts: ModelCategoryElementsCountCache;
  #modelWithCategoryModeledElements: Promise<Map<ModelCategoryKey, Set<ElementId>>> | undefined;
  #categoryClass: string;
  #categoryElementClass: string;
  #categoryModelClass: string;
  #isDefinitionContainerSupported: Promise<boolean> | undefined;
  #filteredElementsModels: Promise<Map<ElementId, ModelId>> | undefined;
  #queryExecutor: LimitingECSqlQueryExecutor;
  #componentId: GuidString;
  #componentName: string;

  constructor(
    queryExecutor: LimitingECSqlQueryExecutor,
    viewType: "3d" | "2d",
    componentId?: GuidString
  ) {
    this.#queryExecutor = queryExecutor;
    const { categoryClass, elementClass, modelClass } = getClassesByView(viewType);
    this.#categoryClass = categoryClass;
    this.#categoryElementClass = elementClass;
    this.#categoryModelClass = modelClass;
    this.#componentId = componentId ?? Guid.createValue();
    this.#componentName = "CategoriesTreeIdsCache";
    this.#categoryElementCounts = new ModelCategoryElementsCountCache(this.#queryExecutor, [elementClass], this.#componentId);
  }

  public [Symbol.dispose]() {
    this.#categoryElementCounts[Symbol.dispose]();
  }

  private async *queryFilteredElementsModels(filteredElementIds: Id64Arg): AsyncIterableIterator<{
    modelId: Id64String;
    id: ElementId;
  }> {
    const query = `
      SELECT Model.Id modelId, ECInstanceId id
      FROM ${this.#categoryElementClass}
      WHERE ECInstanceId IN (${joinId64Arg(filteredElementIds, ",")})
    `;
    for await (const row of this.#queryExecutor.createQueryReader({ ecsql: query }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/filtered-element-models/${Guid.createValue()}` })) {
      yield { modelId: row.modelId, id: row.id };
    }
  }

  public async getFilteredElementsModels(filteredElementIds: Id64Arg) {
    if (Id64.sizeOf(filteredElementIds) === 0) {
      return new Map<ElementId, ModelId>();
    }

    this.#filteredElementsModels ??= (async () => {
      const filteredElementsModels = new Map();
      for await (const { modelId, id } of this.queryFilteredElementsModels(filteredElementIds)) {
        filteredElementsModels.set(id, modelId);
      }
      return filteredElementsModels;
    })();
    return this.#filteredElementsModels;
  }

  public clearFilteredElementsModels() {
    this.#filteredElementsModels = undefined;
  }

  private async *queryElementModelCategories(): AsyncIterableIterator<{
    modelId: Id64String;
    categoryId: Id64String;
  }> {
    const query = `
      SELECT this.Model.Id modelId, this.Category.Id categoryId
      FROM ${this.#categoryModelClass} m
      JOIN ${this.#categoryElementClass} this ON m.ECInstanceId = this.Model.Id
      WHERE this.Parent.Id IS NULL AND m.IsPrivate = false
      GROUP BY modelId, categoryId
    `;
    for await (const row of this.#queryExecutor.createQueryReader(
      { ecsql: query },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/element-models-and-categories` },
    )) {
      yield { modelId: row.modelId, categoryId: row.categoryId };
    }
  }

  private async *queryCategories(): AsyncIterableIterator<{
    id: CategoryId;
    modelId: Id64String;
    parentDefinitionContainerExists: boolean;
    subCategoryChildCount: number;
    hasElements: boolean;
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
        } parentDefinitionContainerExists,
        IFNULL(
          (SELECT 1 FROM ${this.#categoryElementClass} e WHERE e.Category.Id = this.ECInstanceId LIMIT 1),
          0
        ) hasElements
      FROM
        ${this.#categoryClass} this
        JOIN ${CLASS_NAME_SubCategory} sc ON sc.Parent.Id = this.ECInstanceId
        JOIN ${CLASS_NAME_Model} m ON m.ECInstanceId = this.Model.Id
      WHERE
        NOT this.IsPrivate
        AND (NOT m.IsPrivate OR m.ECClassId IS (BisCore.DictionaryModel))
        AND EXISTS (SELECT 1 FROM ${this.#categoryElementClass} e WHERE e.Category.Id = this.ECInstanceId)
      GROUP BY this.ECInstanceId
    `;
    for await (const row of this.#queryExecutor.createQueryReader(
      { ecsql: categoriesQuery },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/categories` },
    )) {
      yield {
        id: row.id,
        modelId: row.modelId,
        parentDefinitionContainerExists: row.parentDefinitionContainerExists,
        subCategoryChildCount: row.subCategoryChildCount,
        hasElements: !!row.hasElements
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

    for await (const _row of this.#queryExecutor.createQueryReader(
      { ecsql: query },
      { restartToken: `${this.#componentName}/${this.#componentId}/is-definition-container-supported` },
    )) {
      return true;
    }
    return false;
  }

  private async *queryDefinitionContainers(): AsyncIterableIterator<{ id: DefinitionContainerId; modelId: Id64String; hasElements: boolean }> {
    // DefinitionModel ECInstanceId will always be the same as modeled DefinitionContainer ECInstanceId, if this wasn't the case, we would need to do something like:
    //  JOIN BisCore.DefinitionModel dm ON dm.ECInstanceId = ${modelIdAccessor}
    //  JOIN BisCore.DefinitionModelBreaksDownDefinitionContainer dr ON dr.SourceECInstanceId = dm.ECInstanceId
    //  JOIN BisCore.DefinitionContainer dc ON dc.ECInstanceId = dr.TargetECInstanceId
    const DEFINITION_CONTAINERS_CTE = "DefinitionContainers";
    const CATEGORIES_MODELS_CTE = "CategoriesModels";
    const ctes = [
      `
        ${CATEGORIES_MODELS_CTE}(ModelId, HasElements) AS (
          SELECT
            c.Model.Id,
            IFNULL((
              SELECT 1
              FROM ${this.#categoryElementClass} e
              WHERE e.Category.Id = c.ECInstanceId
              LIMIT 1
            ), 0)
          FROM
            ${this.#categoryClass} c
          WHERE
            NOT c.IsPrivate
        )
      `,
      `
        ${DEFINITION_CONTAINERS_CTE}(ECInstanceId, ModelId, HasElements) AS (
          SELECT
            dc.ECInstanceId,
            dc.Model.Id,
            c.HasElements
          FROM
            ${CLASS_NAME_DefinitionContainer} dc
          JOIN ${CATEGORIES_MODELS_CTE} c ON dc.ECInstanceId = c.ModelId
          WHERE NOT dc.IsPrivate

          UNION ALL

          SELECT
            pdc.ECInstanceId,
            pdc.Model.Id,
            cdc.HasElements
          FROM
            ${DEFINITION_CONTAINERS_CTE} cdc
            JOIN ${CLASS_NAME_DefinitionContainer} pdc ON pdc.ECInstanceId = cdc.ModelId
          WHERE
            NOT pdc.IsPrivate
        )
      `,
    ];
    const definitionsQuery = `
      SELECT dc.ECInstanceId id, dc.ModelId, MAX(dc.HasElements) hasElements modelId FROM ${DEFINITION_CONTAINERS_CTE} dc GROUP BY dc.ECInstanceId
    `;
    for await (const row of this.#queryExecutor.createQueryReader(
      { ctes, ecsql: definitionsQuery },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/definition-containers` },
    )) {
      yield { id: row.id, modelId: row.modelId, hasElements: !!row.hasElements };
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
    for await (const row of this.#queryExecutor.createQueryReader(
      { ecsql: definitionsQuery },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/visible-sub-categories` },
    )) {
      yield { id: row.id, parentId: row.categoryId };
    }
  }

  private async getModelsCategoriesInfo() {
    this.#modelsCategoriesInfo ??= (async () => {
      const allModelsCategories = new Map<ModelId, CategoriesInfo>();
      for await (const queriedCategory of this.queryCategories()) {
        let modelCategories = allModelsCategories.get(queriedCategory.modelId);
        if (modelCategories === undefined) {
          modelCategories = { parentDefinitionContainerExists: queriedCategory.parentDefinitionContainerExists, childCategories: [] };
          allModelsCategories.set(queriedCategory.modelId, modelCategories);
        }
        modelCategories.childCategories.push({ id: queriedCategory.id, subCategoryChildCount: queriedCategory.subCategoryChildCount, hasElements: queriedCategory.hasElements });
      }
      return allModelsCategories;
    })();
    return this.#modelsCategoriesInfo;
  }

  private async getElementModelsCategories() {
    this.#elementModelsCategories ??= (async () => {
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
    return this.#elementModelsCategories;
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
      FROM ${this.#categoryModelClass} m
      JOIN ${this.#categoryElementClass} pe ON pe.ECInstanceId = m.ModeledElement.Id
      WHERE
        m.IsPrivate = false
        AND m.ECInstanceId IN (SELECT Model.Id FROM ${this.#categoryElementClass})
    `;
    for await (const row of this.#queryExecutor.createQueryReader(
      { ecsql: query },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/modeled-elements` },
    )) {
      yield { modelId: row.modelId, categoryId: row.categoryId, modeledElementId: row.modeledElementId, rootCategoryId: row.rootCategoryId };
    }
  }

  private async getModelWithCategoryModeledElements() {
    this.#modelWithCategoryModeledElements ??= (async () => {
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
    return this.#modelWithCategoryModeledElements;
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
    this.#subCategoriesInfo ??= (async () => {
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
    return this.#subCategoriesInfo;
  }

  private async getDefinitionContainersInfo() {
    this.#definitionContainersInfo ??= (async () => {
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
          childDefinitionContainers: [],
          parentDefinitionContainerExists: false,
          hasElements: queriedDefinitionContainer.hasElements,
        });
      }

      for (const [definitionContainerId, definitionContainerInfo] of definitionContainersInfo) {
        const parentDefinitionContainer = definitionContainersInfo.get(definitionContainerInfo.modelId);
        if (parentDefinitionContainer !== undefined) {
          parentDefinitionContainer.childDefinitionContainers.push({ id: definitionContainerId, hasElements: definitionContainerInfo.hasElements });
          definitionContainerInfo.parentDefinitionContainerExists = true;
        }
      }

      return definitionContainersInfo;
    })();
    return this.#definitionContainersInfo;
  }

  public async getDirectChildDefinitionContainersAndCategories({
    parentDefinitionContainerIds,
    includeEmpty,
  }: {
    parentDefinitionContainerIds: Id64Arg;
    includeEmpty?: boolean;
  }): Promise<{ categories: CategoryInfo[]; definitionContainers: Array<DefinitionContainerId> }> {
    const definitionContainersInfo = await this.getDefinitionContainersInfo();

    const result = { definitionContainers: new Array<DefinitionContainerId>(), categories: new Array<CategoryInfo>() };
    for (const parentDefinitionContainerId of Id64.iterable(parentDefinitionContainerIds)) {
      const parentDefinitionContainerInfo = definitionContainersInfo.get(parentDefinitionContainerId);
      if (!parentDefinitionContainerInfo) {
        continue;
      }
      result.definitionContainers.push(...applyElementsFilter(parentDefinitionContainerInfo.childDefinitionContainers, includeEmpty).map((dc) => dc.id));
      result.categories.push(...applyElementsFilter(parentDefinitionContainerInfo.childCategories, includeEmpty));
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

  public async getAllCategories(): Promise<Id64Set> {
    const result = new Set<Id64String>();
    const modelsCategoriesInfo = await this.getModelsCategoriesInfo();
    modelsCategoriesInfo.forEach(({ childCategories }) => {
      childCategories.forEach(({ id }) => result.add(id));
    });
    return result;
  }

  public async hasSubModel(elementId: Id64String): Promise<boolean> {
    const elementModelsCategories = await this.getElementModelsCategories();
    return elementModelsCategories.has(elementId);
  }

  public async getAllContainedCategories({
    definitionContainerIds,
    includeEmptyCategories,
  }: {
    definitionContainerIds: Id64Arg;
    includeEmptyCategories?: boolean;
  }): Promise<Id64Array> {
    const result = new Array<CategoryId>();

    const definitionContainersInfo = await this.getDefinitionContainersInfo();
    const indirectCategoryPromises = new Array<Promise<Id64Array>>();
    for (const definitionContainerId of Id64.iterable(definitionContainerIds)) {
      const definitionContainerInfo = definitionContainersInfo.get(definitionContainerId);
      if (definitionContainerInfo === undefined) {
        continue;
      }
      result.push(...applyElementsFilter(definitionContainerInfo.childCategories, includeEmptyCategories).map((category) => category.id));
      indirectCategoryPromises.push(this.getAllContainedCategories({
          definitionContainerIds: definitionContainerInfo.childDefinitionContainers.map(({ id }) => id),
          includeEmptyCategories,
        }));
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
            return [{ id: props.categoryId, className: this.#categoryClass }];
          }

          return [...(await this.getInstanceKeyPaths({ definitionContainerId: modelId })), { id: props.categoryId, className: this.#categoryClass }];
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
    return this.#categoryElementCounts.getCategoryElementsCount(modelId, categoryId);
  }

  public async getAllDefinitionContainersAndCategories(props?: { includeEmpty?: boolean }): Promise<{ categories: Array<CategoryId>; definitionContainers: Array<DefinitionContainerId> }> {
    const [modelsCategoriesInfo, definitionContainersInfo] = await Promise.all([this.getModelsCategoriesInfo(), this.getDefinitionContainersInfo()]);
    const result = {
      definitionContainers: new Array<Id64String>(),
      categories: new Array<Id64String>(),
    };
    definitionContainersInfo.forEach((definitionContainerInfo, definitionContainerId) => {
      if (definitionContainerInfo.hasElements || props?.includeEmpty) {
        result.definitionContainers.push(definitionContainerId);
      }
    });
    modelsCategoriesInfo.forEach((modelCategoriesInfo) => {
      applyElementsFilter(modelCategoriesInfo.childCategories, props?.includeEmpty).forEach((childCategory) => {
        result.categories.push(childCategory.id);
      });
    });

    return result;
  }

  public async getRootDefinitionContainersAndCategories(props?: { includeEmpty?: boolean }): Promise<{ categories: CategoryInfo[]; definitionContainers: Array<DefinitionContainerId> }> {
    const [modelsCategoriesInfo, definitionContainersInfo] = await Promise.all([this.getModelsCategoriesInfo(), this.getDefinitionContainersInfo()]);
    const result = { definitionContainers: new Array<Id64String>(), categories: new Array<CategoryInfo>() };
    for (const modelCategoriesInfo of modelsCategoriesInfo.values()) {
      if (!modelCategoriesInfo.parentDefinitionContainerExists) {
        result.categories.push(...applyElementsFilter(modelCategoriesInfo.childCategories, props?.includeEmpty));
      }
    }

    for (const [definitionContainerId, definitionContainerInfo] of definitionContainersInfo) {
      if (!definitionContainerInfo.parentDefinitionContainerExists) {
        if (definitionContainerInfo.hasElements || props?.includeEmpty) {
          result.definitionContainers.push(definitionContainerId);
          continue;
        }
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
    this.#isDefinitionContainerSupported ??= this.queryIsDefinitionContainersSupported();
    return this.#isDefinitionContainerSupported;
  }
}

function applyElementsFilter<T extends { hasElements?: boolean }>(list: T[], includeEmpty: boolean | undefined): T[] {
  return includeEmpty ? list : list.filter(({ hasElements }) => !!hasElements);
}
