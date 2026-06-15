/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, delay, forkJoin, from, map, mergeMap, reduce, shareReplay, tap } from "rxjs";
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

interface CachedData {
  modelsCategoriesInfo: Map<ModelId, { categoriesOfTopMostElements: Set<CategoryId>; allCategories: Set<CategoryId>; isSubModel: boolean }>;
  categoryModelsInfo: Map<CategoryId, Array<{ id: ModelId; isSubModel: boolean; categoryIsOfTopMostElement: boolean }>>;
  categoriesWithParentElements: Set<CategoryId>;
  allCategories: Set<CategoryId>;
  allTopMostElementCategories: Set<CategoryId>;
}

/** @internal */
export class ElementModelCategoriesCache {
  #queryExecutor: LimitingECSqlQueryExecutor;
  #componentId: GuidString;
  #componentName: string;
  #elementClassName: string;
  #modeledElementsCache: ModeledElementsCache;
  #cachedData: Observable<CachedData> | undefined;
  #dataResolved = false;
  #subscriberBatches: Array<{ obs: Observable<CachedData>; subscriberCount: number }> = [];

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
            const categoryModelsEntry = getOrCreate({
              map: acc.categoryModelsInfo,
              key: queriedCategory.categoryId,
              createFunc: () => new Array<{ id: ModelId; isSubModel: boolean; categoryIsOfTopMostElement: boolean }>(),
            });
            categoryModelsEntry.push({
              id: queriedCategory.modelId,
              isSubModel: false,
              categoryIsOfTopMostElement: queriedCategory.isTopMostElementCategory,
            });
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
            categoryModelsInfo: new Map<CategoryId, Array<{ id: ModelId; categoryIsOfTopMostElement: boolean; isSubModel: boolean }>>(),
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
        if (allSubModels.size > 0) {
          for (const categoryModels of modelCategories.categoryModelsInfo.values()) {
            for (const categoryModelEntry of categoryModels) {
              if (allSubModels.has(categoryModelEntry.id)) {
                categoryModelEntry.isSubModel = true;
              }
            }
          }
        }

        return {
          modelsCategoriesInfo,
          categoriesWithParentElements: modelCategories.categoriesWithParentElements,
          allTopMostElementCategories: modelCategories.allTopMostElementCategories,
          allCategories: modelCategories.allCategories,
          categoryModelsInfo: modelCategories.categoryModelsInfo,
        };
      }),
      tap(() => {
        this.#dataResolved = true;
        this.#subscriberBatches = [];
      }),
      shareReplay(),
    );

    // Once the data is resolved, every subscriber gets a synchronous replay, so batching is no longer needed.
    if (this.#dataResolved) {
      return this.#cachedData;
    }

    // While the data is still loading, group subscribers into batches. The first batch subscribes directly to the
    // shared source; each subsequent batch chains off the previous one through a `delay(0)`, so
    // when the source resolves the batches are notified with a slight delay between each batch.
    // This prevents main thread blocking.
    if (this.#subscriberBatches.length === 0) {
      this.#subscriberBatches.push({ obs: this.#cachedData, subscriberCount: 1 });
      return this.#cachedData;
    }

    let lastBatch = this.#subscriberBatches[this.#subscriberBatches.length - 1];

    const maxSubscribersPerBatch = 400;
    if (lastBatch.subscriberCount >= maxSubscribersPerBatch) {
      lastBatch = { obs: lastBatch.obs.pipe(delay(0), shareReplay({ refCount: true })), subscriberCount: 1 };
      this.#subscriberBatches.push(lastBatch);
    } else {
      ++lastBatch.subscriberCount;
    }
    return lastBatch.obs;
  }

  public getCategoryElementModels(props: { categoryId: Id64String }): Observable<{ id: ModelId; isSubModel: boolean; categoryIsOfTopMostElement: boolean }> {
    return this.getCachedData().pipe(mergeMap(({ categoryModelsInfo }) => categoryModelsInfo.get(props.categoryId) ?? []));
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
