/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Guid } from "@itwin/core-bentley";
import { DEFINITION_CONTAINER_CLASS, SUB_CATEGORY_CLASS } from "./ClassNameDefinitions.js";

import type { GuidString, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
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

interface CategoryInfo {
  id: Id64String;
  childCount: number;
  hasElements: boolean;
}

interface SubCategoryInfo {
  categoryId: Id64String;
}

/** @internal */
export class CategoriesTreeIdsCache implements Disposable {
  #definitionContainersInfo: Promise<Map<Id64String, DefinitionContainerInfo>> | undefined;
  #modelsCategoriesInfo: Promise<Map<Id64String, CategoriesInfo>> | undefined;
  #subCategoriesInfo: Promise<Map<Id64String, SubCategoryInfo>> | undefined;
  #elementModelsCategories: Promise<Map<Id64String, Id64Set>> | undefined;
  #categoryClass: string;
  #categoryElementClass: string;
  #categoryModelClass: string;
  #isDefinitionContainerSupported: Promise<boolean> | undefined;
  #queryExecutor: LimitingECSqlQueryExecutor;
  #componentId: GuidString;
  #componentName: string;

  constructor(queryExecutor: LimitingECSqlQueryExecutor, viewType: "3d" | "2d", componentId?: GuidString) {
    this.#queryExecutor = queryExecutor;
    const { categoryClass, categoryElementClass, categoryModelClass } = getClassesByView(viewType);
    this.#categoryClass = categoryClass;
    this.#categoryElementClass = categoryElementClass;
    this.#categoryModelClass = categoryModelClass;
    this.#componentId = componentId ?? Guid.createValue();
    this.#componentName = "CategoriesTreeIdsCache";
  }

  public [Symbol.dispose]() {}

  private async *queryElementModelCategories(): AsyncIterableIterator<{
    modelId: Id64String;
    categoryId: Id64String;
  }> {
    const query = `
      SELECT this.Model.Id modelId, this.Category.Id categoryId
      FROM ${this.#categoryModelClass} m
      JOIN ${this.#categoryElementClass} this ON m.ECInstanceId = this.Model.Id
      WHERE m.IsPrivate = false
      GROUP BY modelId, categoryId
    `;
    for await (const row of this.#queryExecutor.createQueryReader(
      { ecsql: query },
      {
        rowFormat: "ECSqlPropertyNames",
        limit: "unbounded",
        restartToken: `${this.#componentName}/${this.#componentId}/element-models-and-categories`,
      },
    )) {
      yield { modelId: row.modelId, categoryId: row.categoryId };
    }
  }

  private async *queryCategories(): AsyncIterableIterator<{
    id: Id64String;
    modelId: Id64String;
    parentDefinitionContainerExists: boolean;
    childCount: number;
    hasElements: boolean;
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
        } parentDefinitionContainerExists,
        IFNULL(
          (SELECT 1 FROM ${this.#categoryElementClass} e WHERE e.Category.Id = this.ECInstanceId LIMIT 1),
          0
        ) hasElements
      FROM
        ${this.#categoryClass} this
        JOIN ${SUB_CATEGORY_CLASS} sc ON sc.Parent.Id = this.ECInstanceId
        JOIN BisCore.Model m ON m.ECInstanceId = this.Model.Id
      WHERE
        NOT this.IsPrivate
        AND (NOT m.IsPrivate OR m.ECClassId IS (BisCore.DictionaryModel))
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
        childCount: row.childCount,
        hasElements: !!row.hasElements,
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

  private async *queryDefinitionContainers(): AsyncIterableIterator<{ id: Id64String; modelId: Id64String; hasElements: boolean }> {
    // DefinitionModel ECInstanceId will always be the same as modeled DefinitionContainer ECInstanceId, if this wasn't the case, we would need to do something like:
    //  JOIN BisCore.DefinitionModel dm ON dm.ECInstanceId = ${modelIdAccessor}
    //  JOIN BisCore.DefinitionModelBreaksDownDefinitionContainer dr ON dr.SourceECInstanceId = dm.ECInstanceId
    //  JOIN BisCore.DefinitionContainer dc ON dc.ECInstanceId = dr.TargetECInstanceId
    const DEFINITION_CONTAINERS_CTE = "DefinitionContainers";
    const CATEGORIES_MODELS_CTE = "CategoriesModels";
    const ctes = [
      `${CATEGORIES_MODELS_CTE}(ModelId, HasElements) AS (
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
      )`,
      `
        ${DEFINITION_CONTAINERS_CTE}(ECInstanceId, ModelId, HasElements) AS (
          SELECT
            dc.ECInstanceId,
            dc.Model.Id,
            c.HasElements
          FROM ${DEFINITION_CONTAINER_CLASS} dc
          JOIN ${CATEGORIES_MODELS_CTE} c ON dc.ECInstanceId = c.ModelId
          WHERE NOT dc.IsPrivate

          UNION ALL

          SELECT
            pdc.ECInstanceId,
            pdc.Model.Id,
            cdc.HasElements
          FROM
            ${DEFINITION_CONTAINERS_CTE} cdc
            JOIN ${DEFINITION_CONTAINER_CLASS} pdc ON pdc.ECInstanceId = cdc.ModelId
          WHERE NOT pdc.IsPrivate
        )
      `,
    ];
    const definitionsQuery = `
      SELECT dc.ECInstanceId id, dc.ModelId modelId, MAX(dc.HasElements) hasElements FROM ${DEFINITION_CONTAINERS_CTE} dc GROUP BY dc.ECInstanceId
    `;
    for await (const row of this.#queryExecutor.createQueryReader(
      { ctes, ecsql: definitionsQuery },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/definition-containers` },
    )) {
      yield { id: row.id, modelId: row.modelId, hasElements: !!row.hasElements };
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
    for await (const row of this.#queryExecutor.createQueryReader(
      { ecsql: definitionsQuery },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/visible-sub-categories` },
    )) {
      yield { id: row.id, parentId: row.categoryId };
    }
  }

  private async getModelsCategoriesInfo() {
    this.#modelsCategoriesInfo ??= (async () => {
      const allModelsCategories = new Map<Id64String, CategoriesInfo>();
      for await (const queriedCategory of this.queryCategories()) {
        let modelCategories = allModelsCategories.get(queriedCategory.modelId);
        if (modelCategories === undefined) {
          modelCategories = { parentDefinitionContainerExists: queriedCategory.parentDefinitionContainerExists, childCategories: [] };
          allModelsCategories.set(queriedCategory.modelId, modelCategories);
        }
        modelCategories.childCategories.push({ id: queriedCategory.id, childCount: queriedCategory.childCount, hasElements: queriedCategory.hasElements });
      }
      return allModelsCategories;
    })();
    return this.#modelsCategoriesInfo;
  }

  private async getElementModelsCategories() {
    this.#elementModelsCategories ??= (async () => {
      const elementModelsCategories = new Map<Id64String, Id64Set>();
      for await (const queriedCategory of this.queryElementModelCategories()) {
        let modelEntry = elementModelsCategories.get(queriedCategory.modelId);
        if (modelEntry === undefined) {
          modelEntry = new Set();
          elementModelsCategories.set(queriedCategory.modelId, modelEntry);
        }
        modelEntry.add(queriedCategory.categoryId);
      }
      return elementModelsCategories;
    })();
    return this.#elementModelsCategories;
  }

  private async getSubCategoriesInfo() {
    this.#subCategoriesInfo ??= (async () => {
      const allSubCategories = new Map<Id64String, SubCategoryInfo>();
      const modelsCategoriesInfo = await this.getModelsCategoriesInfo();
      const categoriesWithMoreThanOneSubCategory = new Array<Id64String>();
      for (const modelCategoriesInfo of modelsCategoriesInfo.values()) {
        categoriesWithMoreThanOneSubCategory.push(
          ...modelCategoriesInfo.childCategories.filter((categoryInfo) => categoryInfo.childCount > 1).map((categoryInfo) => categoryInfo.id),
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
    parentDefinitionContainerIds: Id64Array;
    includeEmpty?: boolean;
  }): Promise<{ categories: CategoryInfo[]; definitionContainers: Id64Array }> {
    const definitionContainersInfo = await this.getDefinitionContainersInfo();

    const result = { definitionContainers: new Array<Id64String>(), categories: new Array<CategoryInfo>() };

    parentDefinitionContainerIds.forEach((parentDefinitionContainerId) => {
      const parentDefinitionContainerInfo = definitionContainersInfo.get(parentDefinitionContainerId);
      if (parentDefinitionContainerInfo !== undefined) {
        if (includeEmpty) {
          result.definitionContainers.push(...parentDefinitionContainerInfo.childDefinitionContainers.map((dc) => dc.id));
          result.categories.push(...parentDefinitionContainerInfo.childCategories);
        } else {
          result.definitionContainers.push(...parentDefinitionContainerInfo.childDefinitionContainers.filter((dc) => dc.hasElements).map((dc) => dc.id));
          result.categories.push(...parentDefinitionContainerInfo.childCategories.filter((category) => category.hasElements));
        }
      }
    });
    return result;
  }

  public async getCategoriesElementModels(categoryIds: Id64Array): Promise<Map<Id64String, Id64Array>> {
    const elementModelsCategories = await this.getElementModelsCategories();
    const result = new Map<Id64String, Id64Array>();
    for (const categoryId of categoryIds) {
      for (const [modelId, categories] of elementModelsCategories) {
        if (categories.has(categoryId)) {
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

  public async getAllContainedCategories({
    definitionContainerIds,
    includeEmptyCategories,
  }: {
    definitionContainerIds: Id64Array;
    includeEmptyCategories?: boolean;
  }): Promise<Id64Array> {
    const result = new Array<Id64String>();

    const definitionContainersInfo = await this.getDefinitionContainersInfo();
    const indirectCategories = await Promise.all(
      definitionContainerIds.map(async (definitionContainerId) => {
        const definitionContainerInfo = definitionContainersInfo.get(definitionContainerId);
        if (definitionContainerInfo === undefined) {
          return [];
        }
        if (includeEmptyCategories) {
          result.push(...definitionContainerInfo.childCategories.map((category) => category.id));
        } else {
          result.push(...definitionContainerInfo.childCategories.filter((category) => category.hasElements).map((category) => category.id));
        }
        return this.getAllContainedCategories({
          definitionContainerIds: definitionContainerInfo.childDefinitionContainers.map(({ id }) => id),
          includeEmptyCategories,
        });
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
      return [{ id: props.definitionContainerId, className: DEFINITION_CONTAINER_CLASS }];
    }

    return [
      ...(await this.getInstanceKeyPaths({ definitionContainerId: definitionContainerInfo.modelId })),
      { id: props.definitionContainerId, className: DEFINITION_CONTAINER_CLASS },
    ];
  }

  public async getAllDefinitionContainersAndCategories(props?: { includeEmpty?: boolean }): Promise<{
    categories: Id64Array;
    definitionContainers: Id64Array;
  }> {
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
      modelCategoriesInfo.childCategories.forEach((childCategory) => {
        if (childCategory.hasElements || props?.includeEmpty) {
          result.categories.push(childCategory.id);
        }
      });
    });
    return result;
  }

  public async getRootDefinitionContainersAndCategories(props?: { includeEmpty?: boolean }): Promise<{
    categories: CategoryInfo[];
    definitionContainers: Id64Array;
  }> {
    const [modelsCategoriesInfo, definitionContainersInfo] = await Promise.all([this.getModelsCategoriesInfo(), this.getDefinitionContainersInfo()]);
    const result = { definitionContainers: new Array<Id64String>(), categories: new Array<CategoryInfo>() };
    for (const modelCategoriesInfo of modelsCategoriesInfo.values()) {
      if (!modelCategoriesInfo.parentDefinitionContainerExists) {
        if (props?.includeEmpty) {
          result.categories.push(...modelCategoriesInfo.childCategories);
          continue;
        }
        result.categories.push(...modelCategoriesInfo.childCategories.filter((category) => category.hasElements));
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

  public async getSubCategories(categoryId: Id64String): Promise<Id64Array> {
    const subCategoriesInfo = await this.getSubCategoriesInfo();
    const result = new Array<Id64String>();
    for (const [subCategoryId, subCategoryInfo] of subCategoriesInfo) {
      if (subCategoryInfo.categoryId === categoryId) {
        result.push(subCategoryId);
      }
    }
    return result;
  }

  public async getIsDefinitionContainerSupported(): Promise<boolean> {
    this.#isDefinitionContainerSupported ??= this.queryIsDefinitionContainersSupported();
    return this.#isDefinitionContainerSupported;
  }
}

/** @internal */
export function getClassesByView(viewType: "2d" | "3d") {
  return viewType === "2d"
    ? { categoryClass: "BisCore.DrawingCategory", categoryElementClass: "BisCore.GeometricElement2d", categoryModelClass: "BisCore.GeometricModel2d" }
    : { categoryClass: "BisCore.SpatialCategory", categoryElementClass: "BisCore.GeometricElement3d", categoryModelClass: "BisCore.GeometricModel3d" };
}
