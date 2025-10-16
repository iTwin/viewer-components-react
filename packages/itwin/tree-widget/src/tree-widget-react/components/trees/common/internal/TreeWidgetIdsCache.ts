/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { from, map, mergeMap } from "rxjs";
import { Id64 } from "@itwin/core-bentley";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import {
  CLASS_NAME_Category,
  CLASS_NAME_GeometricElement2d,
  CLASS_NAME_GeometricElement3d,
  CLASS_NAME_GeometricModel,
  CLASS_NAME_SubCategory,
} from "./ClassNameDefinitions.js";
import { ModelCategoryElementsCountCache } from "./ModelCategoryElementsCountCache.js";

import type { Observable } from "rxjs";
import type { Id64Arg, Id64Set, Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { CategoryId, ElementId, ModelId, SubCategoryId } from "./Types.js";

interface ModelInfo {
  categories2d: Map<CategoryId, { isRootElementCategory: boolean }>;
  categories3d: Map<CategoryId, { isRootElementCategory: boolean }>;
  isSubModel: boolean;
}

/** @internal */
export interface ITreeWidgetIdsCache {
  hasSubModel: (elementId: Id64String) => Observable<boolean>;
  getElementsCount: (props: { modelId: Id64String; categoryId: Id64String }) => Observable<number>;
  getSubCategories: (props: { categoryIds: Id64Arg }) => Observable<{ id: Id64String; subCategories: Id64Arg | undefined }>;
  getModels: (props: {
    categoryIds: Id64Arg;
    onlyIfRootCategory?: boolean;
    includeSubModels?: boolean;
  }) => Observable<{ id: Id64String; models: Id64Arg | undefined }>;
  getCategories: (props: { modelIds: Id64Arg }) => Observable<{ id: Id64String; drawingCategories?: Id64Arg; spatialCategories?: Id64Arg }>;
  getSubModels: (
    props: { modelIds: Id64Arg } | { categoryIds: Id64Arg; modelId: Id64String | undefined },
  ) => Observable<{ id: Id64String; subModels: Id64Arg | undefined }>;
  getAllCategoriesThatContainElements: () => Observable<{ drawingCategories?: Id64Set; spatialCategories?: Id64Set }>;
}

/** @internal */
export class TreeWidgetIdsCache implements ITreeWidgetIdsCache, Disposable {
  readonly #categoryElementCounts: ModelCategoryElementsCountCache;
  #modelInfos: Promise<Map<ModelId, ModelInfo>> | undefined;
  #modelWithCategoryModeledElements:
    | Promise<Map<ModelId, Map<CategoryId, { modeled2dElements?: Set<ElementId>; modeled3dElements?: Set<ElementId> }>>>
    | undefined;
  #subCategoriesOfCategories: Promise<Map<CategoryId, Set<SubCategoryId>>> | undefined;
  #queryExecutor: LimitingECSqlQueryExecutor;
  #classNamesInfo: { element2dClassName: string; element3dClassName?: string } | { element2dClassName?: string; element3dClassName: string } = {
    element2dClassName: CLASS_NAME_GeometricElement2d,
    element3dClassName: CLASS_NAME_GeometricElement3d,
  };
  readonly #iModelConnection: IModelConnection;

  constructor(iModelConnection: IModelConnection, classNameInfo?: { type: "2d" | "3d"; elementClassName: string }) {
    if (classNameInfo) {
      this.#classNamesInfo = {
        ...(classNameInfo.type === "2d" ? { element2dClassName: classNameInfo.elementClassName } : { element3dClassName: classNameInfo.elementClassName }),
      };
    }
    iModelConnection.key;
    this.#iModelConnection = iModelConnection;
    this.#queryExecutor = createECSqlQueryExecutor(this.#iModelConnection);
    this.#categoryElementCounts = new ModelCategoryElementsCountCache(
      this.#queryExecutor,
      [this.#classNamesInfo.element2dClassName, this.#classNamesInfo.element3dClassName].filter((className) => className !== undefined),
    );
  }

  public get usedIModelConnection() {
    return this.#iModelConnection;
  }

  public [Symbol.dispose]() {
    this.#categoryElementCounts[Symbol.dispose]();
  }

  private async *queryElementModelCategories(): AsyncIterableIterator<{
    modelId: Id64String;
    categoryId: Id64String;
    isRootElementCategory: boolean;
    type: "2d" | "3d";
  }> {
    const getClassNameQuery = (elementClassName: string, type: "2d" | "3d") => {
      return `
        SELECT * FROM (
          SELECT
            '${type}' type,
            this.Model.Id modelId,
            this.Category.Id categoryId,
            MAX(IIF(this.Parent.Id IS NULL, 1, 0)) isRootElementCategory
          FROM ${CLASS_NAME_GeometricModel} m
          JOIN ${elementClassName} this ON m.ECInstanceId = this.Model.Id
          WHERE m.IsPrivate = false
          GROUP BY modelId, categoryId
        )
      `;
    };
    const queryArr = new Array<string>();
    if (this.#classNamesInfo.element2dClassName) {
      queryArr.push(getClassNameQuery(this.#classNamesInfo.element2dClassName, "2d"));
    }
    if (this.#classNamesInfo.element3dClassName) {
      queryArr.push(getClassNameQuery(this.#classNamesInfo.element3dClassName, "3d"));
    }
    const query = queryArr.join(" UNION ALL ");
    for await (const row of this.#queryExecutor.createQueryReader(
      { ecsql: query },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: "tree-widget/tree-widget-ids-cache/element-models-and-categories-query" },
    )) {
      yield { modelId: row.modelId, categoryId: row.categoryId, isRootElementCategory: !!row.isRootElementCategory, type: row.type };
    }
  }

  private async *querySubCategories(): AsyncIterableIterator<{ id: SubCategoryId; parentId: CategoryId }> {
    const query = `
      SELECT
        sc.ECInstanceId id,
        sc.Parent.Id categoryId
      FROM
        ${CLASS_NAME_SubCategory} sc
        JOIN ${CLASS_NAME_Category} c on c.ECInstanceId = sc.Parent.Id
      WHERE
        NOT sc.IsPrivate AND NOT c.IsPrivate
    `;
    for await (const row of this.#queryExecutor.createQueryReader(
      { ecsql: query },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: "tree-widget/tree-widget-ids-cache/sub-categories-query" },
    )) {
      yield { id: row.id, parentId: row.categoryId };
    }
  }

  private async *queryModeledElements(): AsyncIterableIterator<{
    modelId: Id64String;
    modeledElementId: Id64String;
    categoryId: Id64String;
    type: "2d" | "3d";
  }> {
    const getClassNameQuery = (elementClassName: string, type: "2d" | "3d") => {
      return `
        SELECT
          '${type}' type,
          pe.ECInstanceId modeledElementId,
          pe.Category.Id categoryId,
          pe.Model.Id modelId
        FROM ${CLASS_NAME_GeometricModel} m
        JOIN ${elementClassName} pe ON pe.ECInstanceId = m.ModeledElement.Id
        WHERE
          m.IsPrivate = false
          AND m.ECInstanceId IN (SELECT Model.Id FROM BisCore.Element)
      `;
    };
    const queryArr = new Array<string>();
    if (this.#classNamesInfo.element2dClassName) {
      queryArr.push(getClassNameQuery(this.#classNamesInfo.element2dClassName, "2d"));
    }
    if (this.#classNamesInfo.element3dClassName) {
      queryArr.push(getClassNameQuery(this.#classNamesInfo.element3dClassName, "3d"));
    }
    const query = queryArr.join(" UNION ALL ");
    for await (const row of this.#queryExecutor.createQueryReader(
      { ecsql: query },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: "tree-widget/tree-widget-ids-cache/modeled-elements-query" },
    )) {
      yield { modelId: row.modelId, categoryId: row.categoryId, modeledElementId: row.modeledElementId, type: row.type };
    }
  }

  private async getSubCategoriesOfCategories() {
    this.#subCategoriesOfCategories ??= (async () => {
      const subCategoriesOfCategoriesMap = new Map<CategoryId, Set<SubCategoryId>>();
      for await (const { id, parentId } of this.querySubCategories()) {
        let categoryEntry = subCategoriesOfCategoriesMap.get(parentId);
        if (!categoryEntry) {
          categoryEntry = new Set([id]);
          subCategoriesOfCategoriesMap.set(parentId, categoryEntry);
          continue;
        }
        categoryEntry.add(id);
      }
      return subCategoriesOfCategoriesMap;
    })();
    return this.#subCategoriesOfCategories;
  }

  private async getModelWithCategoryModeledElements() {
    this.#modelWithCategoryModeledElements ??= (async () => {
      const modelWithCategoryModeledElements = new Map<ModelId, Map<CategoryId, { modeled2dElements?: Set<ElementId>; modeled3dElements?: Set<ElementId> }>>();
      for await (const { modelId, categoryId, modeledElementId, type } of this.queryModeledElements()) {
        let modelEntry = modelWithCategoryModeledElements.get(modelId);
        if (!modelEntry) {
          modelEntry = new Map();
          modelEntry.set(categoryId, type === "2d" ? { modeled2dElements: new Set([modeledElementId]) } : { modeled3dElements: new Set([modeledElementId]) });
          modelWithCategoryModeledElements.set(modelId, modelEntry);
          continue;
        }
        let categoryEntry = modelEntry.get(categoryId);
        if (!categoryEntry) {
          categoryEntry = type === "2d" ? { modeled2dElements: new Set([modeledElementId]) } : { modeled3dElements: new Set([modeledElementId]) };
          modelEntry.set(categoryId, categoryEntry);
          continue;
        }
        if (type === "2d") {
          (categoryEntry.modeled2dElements ??= new Set()).add(modeledElementId);
        } else {
          (categoryEntry.modeled3dElements ??= new Set()).add(modeledElementId);
        }
      }
      return modelWithCategoryModeledElements;
    })();
    return this.#modelWithCategoryModeledElements;
  }

  private async getModelInfos() {
    this.#modelInfos ??= (async () => {
      const [modelCategories, modelWithCategoryModeledElements] = await Promise.all([
        (async () => {
          const elementModelsCategories = new Map<ModelId, Omit<ModelInfo, "isSubModel">>();
          for await (const queriedCategory of this.queryElementModelCategories()) {
            let modelEntry = elementModelsCategories.get(queriedCategory.modelId);
            if (!modelEntry) {
              modelEntry = { categories2d: new Map(), categories3d: new Map() };
              elementModelsCategories.set(queriedCategory.modelId, modelEntry);
            }
            switch (queriedCategory.type) {
              case "2d":
                modelEntry.categories2d.set(queriedCategory.categoryId, { isRootElementCategory: queriedCategory.isRootElementCategory });
                break;
              case "3d":
                modelEntry.categories3d.set(queriedCategory.categoryId, { isRootElementCategory: queriedCategory.isRootElementCategory });
                break;
            }
          }
          return elementModelsCategories;
        })(),
        this.getModelWithCategoryModeledElements(),
      ]);
      const result = new Map<ModelId, ModelInfo>();
      const subModels = new Set<Id64String>();
      modelWithCategoryModeledElements?.forEach((categoryMap) =>
        categoryMap.forEach((categoryEntry) => {
          categoryEntry.modeled2dElements?.forEach((modeledElement2d) => subModels.add(modeledElement2d));
          categoryEntry.modeled3dElements?.forEach((modeledElement3d) => subModels.add(modeledElement3d));
        }),
      );
      for (const [modelId, modelEntry] of modelCategories) {
        const isSubModel = subModels.has(modelId);
        result.set(modelId, { categories2d: modelEntry.categories2d, categories3d: modelEntry.categories3d, isSubModel });
      }
      return result;
    })();
    return this.#modelInfos;
  }

  public getAllCategoriesThatContainElements(): ReturnType<ITreeWidgetIdsCache["getAllCategoriesThatContainElements"]> {
    return from(this.getModelInfos()).pipe(
      map((modelInfos) => {
        const resultDrawing = new Set<Id64String>();
        const resultSpatial = new Set<Id64String>();
        modelInfos.forEach(({ categories2d, categories3d }) => {
          categories2d.forEach((_, id) => resultDrawing.add(id));
          categories3d.forEach((_, id) => resultSpatial.add(id));
        });
        return {
          drawingCategories: resultDrawing.size > 0 ? resultDrawing : undefined,
          spatialCategories: resultSpatial.size > 0 ? resultSpatial : undefined,
        };
      }),
    );
  }

  public hasSubModel(elementId: Parameters<ITreeWidgetIdsCache["hasSubModel"]>[0]): ReturnType<ITreeWidgetIdsCache["hasSubModel"]> {
    return from(this.getModelInfos()).pipe(
      map((modelInfos) => {
        const modeledElementInfo = modelInfos.get(elementId);
        return !modeledElementInfo;
      }),
    );
  }

  public getElementsCount({
    modelId,
    categoryId,
  }: Parameters<ITreeWidgetIdsCache["getElementsCount"]>[0]): ReturnType<ITreeWidgetIdsCache["getElementsCount"]> {
    return from(this.#categoryElementCounts.getCategoryElementsCount(modelId, categoryId));
  }

  public getSubCategories({ categoryIds }: Parameters<ITreeWidgetIdsCache["getSubCategories"]>[0]): ReturnType<ITreeWidgetIdsCache["getSubCategories"]> {
    return from(this.getSubCategoriesOfCategories()).pipe(
      mergeMap((subCategoriesOfCategories) =>
        from(Id64.iterable(categoryIds)).pipe(
          map((categoryId) => {
            return { id: categoryId, subCategories: subCategoriesOfCategories.get(categoryId) };
          }),
        ),
      ),
    );
  }

  public getModels({
    categoryIds,
    onlyIfRootCategory,
    includeSubModels,
  }: Parameters<ITreeWidgetIdsCache["getModels"]>[0]): ReturnType<ITreeWidgetIdsCache["getModels"]> {
    return from(this.getModelInfos()).pipe(
      mergeMap((modelInfos) =>
        from(Id64.iterable(categoryIds)).pipe(
          map((categoryId) => {
            const models = new Array<ModelId>();
            modelInfos.forEach((modelEntry, modelId) => {
              if (!includeSubModels && modelEntry.isSubModel) {
                return;
              }
              const entry = modelEntry.categories2d.get(categoryId) ?? modelEntry.categories3d.get(categoryId);
              if (entry && (!onlyIfRootCategory || entry.isRootElementCategory)) {
                models.push(modelId);
              }
            });
            return { id: categoryId, models: models.length > 0 ? models : undefined };
          }),
        ),
      ),
    );
  }

  public getCategories({ modelIds }: Parameters<ITreeWidgetIdsCache["getCategories"]>[0]): ReturnType<ITreeWidgetIdsCache["getCategories"]> {
    return from(this.getModelInfos()).pipe(
      mergeMap((modelInfos) =>
        from(Id64.iterable(modelIds)).pipe(
          map((modelId) => {
            const entry = modelInfos.get(modelId);
            if (!entry) {
              return { id: modelId };
            }
            const drawingCategories = [...entry.categories2d.keys()];
            const spatialCategories = [...entry.categories3d.keys()];
            return {
              id: modelId,
              drawingCategories: drawingCategories.length > 0 ? drawingCategories : undefined,
              spatialCategories: spatialCategories.length > 0 ? spatialCategories : undefined,
            };
          }),
        ),
      ),
    );
  }

  public getSubModels(props: Parameters<ITreeWidgetIdsCache["getSubModels"]>[0]): ReturnType<ITreeWidgetIdsCache["getSubModels"]> {
    return from(this.getModelWithCategoryModeledElements()).pipe(
      mergeMap((modelWithCategoryModeledElements) => {
        if ("modelIds" in props) {
          return from(Id64.iterable(props.modelIds)).pipe(
            map((modelId) => {
              const subModels = new Array<ModelId>();
              const modelEntry = modelWithCategoryModeledElements.get(modelId);
              if (!modelEntry) {
                return { id: modelId, subModels: undefined };
              }
              modelEntry.forEach((categoryEntry) => {
                if (categoryEntry.modeled2dElements) {
                  subModels.push(...categoryEntry.modeled2dElements);
                }
                if (categoryEntry.modeled3dElements) {
                  subModels.push(...categoryEntry.modeled3dElements);
                }
              });
              return {
                id: modelId,
                subModels: subModels.length > 0 ? subModels : undefined,
              };
            }),
          );
        }

        if (props.modelId) {
          const modelEntry = modelWithCategoryModeledElements.get(props.modelId);
          return from(Id64.iterable(props.categoryIds)).pipe(
            map((categoryId) => {
              const categoryEntry = modelEntry?.get(categoryId);
              let subModels: Id64Arg | undefined = categoryEntry?.modeled2dElements?.size ? categoryEntry.modeled2dElements : undefined;
              if (categoryEntry?.modeled3dElements?.size) {
                subModels = subModels ? [...subModels, ...categoryEntry.modeled3dElements] : categoryEntry.modeled3dElements;
              }
              return { id: categoryId, subModels };
            }),
          );
        }

        return from(Id64.iterable(props.categoryIds)).pipe(
          map((categoryId) => {
            const subModels = new Array<ModelId>();
            modelWithCategoryModeledElements.forEach((modelEntry) => {
              const categoryEntry = modelEntry.get(categoryId);
              if (categoryEntry?.modeled2dElements) {
                subModels.push(...categoryEntry.modeled2dElements);
              }
              if (categoryEntry?.modeled3dElements) {
                subModels.push(...categoryEntry.modeled3dElements);
              }
            });
            return {
              id: categoryId,
              subModels: subModels.length > 0 ? subModels : undefined,
            };
          }),
        );
      }),
    );
  }
}
