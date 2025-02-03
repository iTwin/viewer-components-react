/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { InstanceKey } from "@itwin/presentation-shared";

interface DefinitionContainerInfo {
  modelId: Id64String;
  parentDefinitionContainerExists: boolean;
  childCategories: Id64Array;
  childDefinitionContainers: Id64Array;
}

interface CategoriesInfo {
  childCategories: CategoryInfo[];
  parentDefinitionContainerExists: boolean;
}

interface CategoryInfo {
  id: Id64String;
  childCound: number;
}

interface SubCategoryInfo {
  categoryId: Id64String;
}

/** @internal */
export const SUB_CATEGORY_CLASS = "BisCore.SubCategory";
/** @internal */
export const DEFINITION_CONTAINER_CLASS = "BisCore.DefinitionContainer";

/** @internal */
export class CategoriesTreeIdsCache {
  private _definitionContainersInfo: Promise<Map<Id64String, DefinitionContainerInfo>> | undefined;
  private _modelsCategoriesInfo: Promise<Map<Id64String, CategoriesInfo>> | undefined;
  private _subCategoriesInfo: Promise<Map<Id64String, SubCategoryInfo>> | undefined;
  private _categoryClass: string;
  private _categoryElementClass: string;

  constructor(
    private _queryExecutor: LimitingECSqlQueryExecutor,
    viewType: "3d" | "2d",
  ) {
    const { categoryClass, categoryElementClass } = getClassesByView(viewType);
    this._categoryClass = categoryClass;
    this._categoryElementClass = categoryElementClass;
  }

  private async *queryCategories(): AsyncIterableIterator<{
    id: Id64String;
    modelId: Id64String;
    parentDefinitionContainerExists: boolean;
    childCount: number;
  }> {
    const categoriesCteName = "AllVisibleCategories";
    const categoriesWithChildCountCteName = "CategoriesWithChildCount";

    const ctes = [
      `${categoriesWithChildCountCteName}(ECInstanceId, ChildCount, ModelId) as (
        SELECT
          this.ECInstanceId,
          COUNT(sc.ECInstanceId),
          this.Model.Id
        FROM
          ${this._categoryClass} this
          JOIN ${SUB_CATEGORY_CLASS} sc ON sc.Parent.Id = this.ECInstanceId
          JOIN BisCore.Model m ON m.ECInstanceId = this.Model.Id
        WHERE
          NOT this.IsPrivate
          AND (NOT m.IsPrivate OR m.ECClassId IS (BisCore.DictionaryModel))
          AND EXISTS (SELECT 1 FROM ${this._categoryElementClass} e WHERE e.Category.Id = this.ECInstanceId)
        GROUP BY this.ECInstanceId
      )`,
      `${categoriesCteName}(ECInstanceId, CategoryModelId, CurrentModelId, ParentDefinitionContainerExists, ChildCount) AS (
        SELECT
          this.ECInstanceId,
          this.ModelId,
          this.ModelId,
          false,
          this.ChildCount
        FROM
          ${categoriesWithChildCountCteName} this

        UNION ALL

        SELECT
          ce.ECInstanceId,
          ce.CategoryModelId,
          pe.Model.Id,
          true,
          ce.ChildCount
        FROM
          ${categoriesCteName} ce
          JOIN ${DEFINITION_CONTAINER_CLASS} pe ON ce.CurrentModelId = pe.ECInstanceId
        WHERE
          NOT pe.IsPrivate
      )`,
    ];
    const categoriesQuery = `
      SELECT
        this.ECInstanceId id,
        this.CategoryModelId modelId,
        this.ParentDefinitionContainerExists parentDefinitionContainerExists,
        this.ChildCount childCound
      FROM
        ${categoriesCteName} this
      WHERE
        this.CurrentModelId NOT IN (SELECT dm.ECInstanceId FROM ${DEFINITION_CONTAINER_CLASS} dm)
    `;
    for await (const row of this._queryExecutor.createQueryReader({ ctes, ecsql: categoriesQuery }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { id: row.id, modelId: row.modelId, parentDefinitionContainerExists: row.parentDefinitionContainerExists, childCount: row.childCound };
    }
  }

  private async *queryDefinitionContainers(categoriesModelIds: Id64Array): AsyncIterableIterator<{ id: Id64String; modelId: Id64String }> {
    // DefinitionModel ECInstanceId will always be the same as modeled DefinitionContainer ECInstanceId, if this wasn't the case, we would need to do something like:
    //  JOIN BisCore.DefinitionModel dm ON dm.ECInstanceId = ${modelIdAccessor}
    //  JOIN BisCore.DefinitionModelBreaksDownDefinitionContainer dr ON dr.SourceECInstanceId = dm.ECInstanceId
    //  JOIN BisCore.DefinitionContainer dc ON dc.ECInstanceId = dr.TargetECInstanceId
    const definitionContainersCteName = "DefinitionContainers";
    const ctes = [
      `
        ${definitionContainersCteName}(ECInstanceId, ModelId) AS (
          SELECT
            dc.ECInstanceId,
            dc.Model.Id
          FROM
            ${DEFINITION_CONTAINER_CLASS} dc
          WHERE
            dc.ECInstanceId IN (${categoriesModelIds.join(", ")})
            AND NOT dc.IsPrivate

          UNION ALL

          SELECT
            pdc.ECInstanceId,
            pdc.Model.Id
          FROM
            ${definitionContainersCteName} cdc
            JOIN ${DEFINITION_CONTAINER_CLASS} pdc ON pdc.ECInstanceId = cdc.ModelId
          WHERE
            NOT pdc.IsPrivate
        )
      `,
    ];
    const definitionsQuery = `
      SELECT dc.ECInstanceId id, dc.ModelId modelId FROM ${definitionContainersCteName} dc GROUP BY dc.ECInstanceId
    `;
    for await (const row of this._queryExecutor.createQueryReader({ ctes, ecsql: definitionsQuery }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
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
    for await (const row of this._queryExecutor.createQueryReader({ ecsql: definitionsQuery }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
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
        modelCategories.childCategories.push({ id: queriedCategory.id, childCound: queriedCategory.childCount });
      }
      return allModelsCategories;
    })();
    return this._modelsCategoriesInfo;
  }

  private async getSubCategoriesInfo() {
    this._subCategoriesInfo ??= (async () => {
      const allSubCategories = new Map<Id64String, SubCategoryInfo>();
      const modelsCategoriesInfo = await this.getModelsCategoriesInfo();
      const categoriesWithMoreThanOneSubCategory = new Array<Id64String>();
      for (const modelCategoriesInfo of modelsCategoriesInfo.values()) {
        categoriesWithMoreThanOneSubCategory.push(
          ...modelCategoriesInfo.childCategories.filter((categoryInfo) => categoryInfo.childCound > 1).map((categoryInfo) => categoryInfo.id),
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
      const modelsCategoriesInfo = await this.getModelsCategoriesInfo();
      const definitionContainersInfo = new Map<Id64String, DefinitionContainerInfo>();
      if (modelsCategoriesInfo.size === 0) {
        return definitionContainersInfo;
      }

      const categoriesModelIds = [...modelsCategoriesInfo.keys()];

      for await (const queriedDefinitionContainer of this.queryDefinitionContainers(categoriesModelIds)) {
        const modelCategoriesInfo = modelsCategoriesInfo.get(queriedDefinitionContainer.id);

        definitionContainersInfo.set(queriedDefinitionContainer.id, {
          childCategories: modelCategoriesInfo?.childCategories.map((childCategory) => childCategory.id) ?? [],
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
  ): Promise<{ categories: Id64Array; definitionContainers: Id64Array }> {
    const definitionContainersInfo = await this.getDefinitionContainersInfo();

    const result = { definitionContainers: new Array<Id64String>(), categories: new Array<Id64String>() };

    parentDefinitionContainerIds.forEach((parentDefinitionContainerId) => {
      const parentDefinitionContainerInfo = definitionContainersInfo.get(parentDefinitionContainerId);
      if (parentDefinitionContainerInfo !== undefined) {
        result.definitionContainers.push(...parentDefinitionContainerInfo.childDefinitionContainers);
        result.categories.push(...parentDefinitionContainerInfo.childCategories);
      }
    });
    return result;
  }

  public async getAllContainedCategories(definitionContainerId: Id64String): Promise<Id64Array> {
    const result = new Array<Id64String>();

    const definitionContainersInfo = await this.getDefinitionContainersInfo();
    const definitionContainerInfo = definitionContainersInfo.get(definitionContainerId);
    if (definitionContainerInfo === undefined) {
      return result;
    }

    const directChildCategories = definitionContainerInfo.childCategories;
    const directChildDefinitionContainers = definitionContainerInfo.childDefinitionContainers;

    result.push(...directChildCategories);
    for (const definitionContainer of directChildDefinitionContainers) {
      const definitionContainerResult = await this.getAllContainedCategories(definitionContainer);
      result.push(...definitionContainerResult);
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

  public async getAllDefinitionContainersAndCategories(): Promise<{ categories: Id64Array; definitionContainers: Id64Array }> {
    const [modelsCategoriesInfo, definitionContainersInfo] = await Promise.all([
      this.getModelsCategoriesInfo(),
      this.getDefinitionContainersInfo(),
    ]);
    const result = { definitionContainers: [...definitionContainersInfo.keys()], categories: new Array<Id64String>() };
    for (const modelCategoriesInfo of modelsCategoriesInfo.values()) {
      result.categories.push(...modelCategoriesInfo.childCategories.map((childCategory) => childCategory.id));
    }

    return result;
  }

  public async getRootDefinitionContainersAndCategories(): Promise<{ categories: Id64Array; definitionContainers: Id64Array }> {
    const modelsCategoriesInfo = await this.getModelsCategoriesInfo();
    const result = { definitionContainers: new Array<Id64String>(), categories: new Array<Id64String>() };
    for (const modelCategoriesInfo of modelsCategoriesInfo.values()) {
      if (!modelCategoriesInfo.parentDefinitionContainerExists) {
        result.categories.push(...modelCategoriesInfo.childCategories.map((childCategory) => childCategory.id));
      }
    }

    const definitionContainersInfo = await this.getDefinitionContainersInfo();

    for (const [definitionContainerId, definitionContainerInfo] of definitionContainersInfo) {
      if (!definitionContainerInfo.parentDefinitionContainerExists) {
        result.definitionContainers.push(definitionContainerId);
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
}

/** @internal */
export function getClassesByView(viewType: "2d" | "3d") {
  return viewType === "2d"
    ? { categoryClass: "BisCore.DrawingCategory", categoryElementClass: "BisCore:GeometricElement2d" }
    : { categoryClass: "BisCore.SpatialCategory", categoryElementClass: "BisCore:GeometricElement3d" };
}
