/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Id64 } from "@itwin/core-bentley";
import { CLASS_NAME_DefinitionContainer, CLASS_NAME_Model, CLASS_NAME_SubCategory } from "../../common/internal/ClassNameDefinitions.js";
import { getClassesByView, joinId64Arg } from "../../common/internal/Utils.js";

import type { Id64Arg, Id64Array, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { InstanceKey } from "@itwin/presentation-shared";
import type { ITreeWidgetIdsCache, TreeWidgetIdsCache } from "../../common/internal/TreeWidgetIdsCache.js";
import type { CategoryId, DefinitionContainerId, ElementId, ModelId, SubCategoryId } from "../../common/internal/Types.js";

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

/** @internal */
export class CategoriesTreeIdsCache implements Disposable, ITreeWidgetIdsCache {
  #definitionContainersInfo: Promise<Map<DefinitionContainerId, DefinitionContainerInfo>> | undefined;
  #modelsCategoriesInfo: Promise<Map<ModelId, CategoriesInfo>> | undefined;
  #subCategoriesInfo: Promise<Map<SubCategoryId, SubCategoryInfo>> | undefined;
  #categoryClass: string;
  #categoryElementClass: string;
  #categoryModelClass: string;
  #isDefinitionContainerSupported: Promise<boolean> | undefined;
  #filteredElementsModels: Promise<Map<ElementId, ModelId>> | undefined;
  #queryExecutor: LimitingECSqlQueryExecutor;
  #treeWidgetIdsCache: TreeWidgetIdsCache;
  #shouldDisposeTreeWidgetIdsCache = false;

  constructor(queryExecutor: LimitingECSqlQueryExecutor, viewType: "3d" | "2d", treeWidgetIdsCacheInfo: { cache: TreeWidgetIdsCache; shouldDispose: boolean }) {
    this.#queryExecutor = queryExecutor;
    const { categoryClass, elementClass, modelClass } = getClassesByView(viewType);
    this.#categoryClass = categoryClass;
    this.#categoryElementClass = elementClass;
    this.#categoryModelClass = modelClass;
    this.#treeWidgetIdsCache = treeWidgetIdsCacheInfo.cache;
    this.#shouldDisposeTreeWidgetIdsCache = treeWidgetIdsCacheInfo.shouldDispose;
  }

  public [Symbol.dispose]() {
    if (this.#shouldDisposeTreeWidgetIdsCache) {
      this.#treeWidgetIdsCache[Symbol.dispose]();
    }
  }

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
    return this.#treeWidgetIdsCache.getModels({ ...props, includeSubModels: true });
  }

  public getSubCategories(props: Parameters<ITreeWidgetIdsCache["getSubCategories"]>[0]) {
    return this.#treeWidgetIdsCache.getSubCategories(props);
  }

  public getSubModels(props: Parameters<ITreeWidgetIdsCache["getSubModels"]>[0]) {
    return this.#treeWidgetIdsCache.getSubModels(props);
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
    for await (const row of this.#queryExecutor.createQueryReader({ ecsql: query }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
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

    for await (const _row of this.#queryExecutor.createQueryReader(
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
            dc.ECInstanceId IN (SELECT c.Model.Id FROM ${this.#categoryClass} c WHERE NOT c.IsPrivate AND EXISTS (SELECT 1 FROM ${this.#categoryElementClass} e WHERE e.Category.Id = c.ECInstanceId))
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
    for await (const row of this.#queryExecutor.createQueryReader(
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
    for await (const row of this.#queryExecutor.createQueryReader(
      { ecsql: definitionsQuery },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: "tree-widget/categories-tree/sub-categories-query" },
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
        modelCategories.childCategories.push({ id: queriedCategory.id, subCategoryChildCount: queriedCategory.subCategoryChildCount });
      }
      return allModelsCategories;
    })();
    return this.#modelsCategoriesInfo;
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
    return this.#definitionContainersInfo;
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

  public async getIsDefinitionContainerSupported(): Promise<boolean> {
    this.#isDefinitionContainerSupported ??= this.queryIsDefinitionContainersSupported();
    return this.#isDefinitionContainerSupported;
  }
}
