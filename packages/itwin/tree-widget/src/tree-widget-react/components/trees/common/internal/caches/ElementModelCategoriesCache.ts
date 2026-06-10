/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, EMPTY, forkJoin, from, map, mergeMap, of, reduce, shareReplay } from "rxjs";
import { CLASS_NAME_Model } from "../ClassNameDefinitions.js";
import { catchBeSQLiteInterrupts } from "../UseErrorState.js";
import { getOrCreate, releaseMainThreadOnItemsCount } from "../Utils.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { CategoryId, ModelId } from "../Types.js";
import type { ModeledElementsCache } from "./ModeledElementsCache.js";

interface ElementModelCategoriesCacheProps {
  queryExecutor: LimitingECSqlQueryExecutor;
  componentId: GuidString;
  elementClassName: string;
  modeledElementsCache: ModeledElementsCache;
}

/** @internal */
export class ElementModelCategoriesCache {
  #queryExecutor: LimitingECSqlQueryExecutor;
  #componentId: GuidString;
  #componentName: string;
  #elementClassName: string;
  #modeledElementsCache: ModeledElementsCache;
  #cachedData:
    | Observable<{
        modelsCategoriesInfo: Map<ModelId, { categoriesOfTopMostElements: Set<CategoryId>; allCategories: Set<CategoryId>; isSubModel: boolean }>;
        categoriesWithParentElements: Set<CategoryId>;
        allCategories: Set<CategoryId>;
        allTopMostElementCategories: Set<CategoryId>;
      }>
    | undefined;

  constructor(props: ElementModelCategoriesCacheProps) {
    this.#queryExecutor = props.queryExecutor;
    this.#elementClassName = props.elementClassName;
    this.#modeledElementsCache = props.modeledElementsCache;
    this.#componentId = props.componentId;
    this.#componentName = "ElementModelCategoriesCache";
  }

  private queryElementModelCategories(): Observable<{
    modelId: Id64String;
    categoryId: Id64String;
    isTopMostElementCategory: boolean;
    hasParentElements: boolean;
  }> {
    return defer(() => {
      const query = `
          SELECT
            this.Model.Id modelId,
            this.Category.Id categoryId,
            MAX(IIF(this.Parent.Id IS NULL, 1, 0)) isTopMostElementCategory,
            MAX(IIF((SELECT 1 FROM ${this.#elementClassName} ce WHERE ce.Parent.Id = this.ECInstanceId LIMIT 1), 1, 0)) hasParentElements
          FROM ${CLASS_NAME_Model} m
          JOIN ${this.#elementClassName} this ON m.ECInstanceId = this.Model.Id
          WHERE m.IsPrivate = false
          GROUP BY modelId, categoryId
        `;
      return this.#queryExecutor.createQueryReader(
        { ecsql: query },
        { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/element-models-and-categories` },
      );
    }).pipe(
      catchBeSQLiteInterrupts,
      map((row) => {
        return {
          modelId: row.modelId,
          categoryId: row.categoryId,
          isTopMostElementCategory: !!row.isTopMostElementCategory,
          hasParentElements: !!row.hasParentElements,
        };
      }),
    );
  }

  private getCachedData() {
    this.#cachedData ??= forkJoin({
      modelCategories: this.queryElementModelCategories().pipe(
        reduce(
          (acc, queriedCategory) => {
            acc.allCategories.add(queriedCategory.categoryId);
            const modelEntry = getOrCreate({
              map: acc.modelsCategoriesInfo,
              key: queriedCategory.modelId,
              createFunc: () => ({ categoriesOfTopMostElements: new Set<string>(), allCategories: new Set<string>() }),
            });
            modelEntry.allCategories.add(queriedCategory.categoryId);
            if (queriedCategory.isTopMostElementCategory) {
              modelEntry.categoriesOfTopMostElements.add(queriedCategory.categoryId);
              acc.allTopMostElementCategories.add(queriedCategory.categoryId);
            }
            if (queriedCategory.hasParentElements) {
              acc.categoriesWithParentElements.add(queriedCategory.categoryId);
            }
            return acc;
          },
          {
            modelsCategoriesInfo: new Map<ModelId, { categoriesOfTopMostElements: Set<CategoryId>; allCategories: Set<CategoryId> }>(),
            categoriesWithParentElements: new Set<CategoryId>(),
            allTopMostElementCategories: new Set<CategoryId>(),
            allCategories: new Set<CategoryId>(),
          },
        ),
      ),
      allSubModels: this.#modeledElementsCache.getModeledElementsInfo().pipe(map(({ allSubModels }) => allSubModels)),
    }).pipe(
      releaseMainThreadOnItemsCount(1),
      map(({ modelCategories, allSubModels }) => {
        const modelsCategoriesInfo = new Map<ModelId, { categoriesOfTopMostElements: Set<CategoryId>; allCategories: Set<CategoryId>; isSubModel: boolean }>();
        for (const [modelId, { categoriesOfTopMostElements, allCategories }] of modelCategories.modelsCategoriesInfo) {
          const isSubModel = allSubModels.has(modelId);
          modelsCategoriesInfo.set(modelId, {
            categoriesOfTopMostElements,
            allCategories,
            isSubModel,
          });
        }
        return {
          modelsCategoriesInfo,
          categoriesWithParentElements: modelCategories.categoriesWithParentElements,
          allTopMostElementCategories: modelCategories.allTopMostElementCategories,
          allCategories: modelCategories.allCategories,
        };
      }),
      shareReplay(),
    );
    return this.#cachedData;
  }

  public getCategoryElementModels(props: { categoryId: Id64String }): Observable<{ id: ModelId; isSubModel: boolean; categoryIsOfTopMostElement: boolean }> {
    return this.getCachedData().pipe(
      mergeMap(({ modelsCategoriesInfo }) => modelsCategoriesInfo.entries()),
      mergeMap(([modelId, modelEntry]) => {
        if (!modelEntry.allCategories.has(props.categoryId)) {
          return EMPTY;
        }
        return of({ id: modelId, isSubModel: modelEntry.isSubModel, categoryIsOfTopMostElement: modelEntry.categoriesOfTopMostElements.has(props.categoryId) });
      }),
    );
  }

  public getModelCategoryIds({
    modelId,
    includeOnlyIfCategoryOfTopMostElement,
  }: {
    modelId: Id64String;
    includeOnlyIfCategoryOfTopMostElement?: boolean;
  }): Observable<Id64Set> {
    return this.getCachedData().pipe(
      map(
        ({ modelsCategoriesInfo }) =>
          (includeOnlyIfCategoryOfTopMostElement
            ? modelsCategoriesInfo.get(modelId)?.categoriesOfTopMostElements
            : modelsCategoriesInfo.get(modelId)?.allCategories) ?? new Set(),
      ),
    );
  }

  public getCategoriesOfModelsTopMostElements(modelIds: Id64Array): Observable<Id64Set> {
    return this.getCachedData().pipe(
      mergeMap(({ modelsCategoriesInfo }) => from(modelIds).pipe(mergeMap((modelId) => modelsCategoriesInfo.get(modelId)?.categoriesOfTopMostElements ?? []))),
      reduce((acc, categoryId) => {
        acc.add(categoryId);
        return acc;
      }, new Set<Id64String>()),
    );
  }

  public getAllCategoriesOfElements(): Observable<Id64Set> {
    return this.getCachedData().pipe(map(({ allCategories }) => allCategories));
  }

  public getAllTopMostElementCategories(): Observable<Id64Set> {
    return this.getCachedData().pipe(map(({ allTopMostElementCategories }) => allTopMostElementCategories));
  }

  public getAllModels(): Observable<Array<ModelId>> {
    return this.getCachedData().pipe(map(({ modelsCategoriesInfo }) => [...modelsCategoriesInfo.keys()]));
  }

  public categoryHasParentElements(categoryId: Id64String): Observable<boolean> {
    return this.getCachedData().pipe(map(({ categoriesWithParentElements }) => categoriesWithParentElements.has(categoryId)));
  }
}
