/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, delay, map, reduce, shareReplay, tap } from "rxjs";
import { CLASS_NAME_Model } from "../ClassNameDefinitions.js";
import { catchBeSQLiteInterrupts } from "../UseErrorState.js";
import { getOrCreate } from "../Utils.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { CategoryId, ModelId } from "../Types.js";

interface ElementModelCategoriesCacheProps {
  queryExecutor: LimitingECSqlQueryExecutor;
  componentId: GuidString;
  elementClassName: string;
}

interface CachedData {
  modelsCategoriesInfo: Map<ModelId, { categoriesOfTopMostElements: Set<CategoryId>; allCategories: Set<CategoryId> }>;
  categoryModelsInfo: Map<CategoryId, Array<{ id: ModelId; categoryIsOfTopMostElement: boolean }>>;
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
  #cachedData: Observable<CachedData> | undefined;
  #dataResolved = false;
  #subscriberBatches: Array<{ obs: Observable<CachedData>; subscriberCount: number }> = [];

  constructor(props: ElementModelCategoriesCacheProps) {
    this.#queryExecutor = props.queryExecutor;
    this.#elementClassName = props.elementClassName;
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

  public getCachedData() {
    this.#cachedData ??= this.queryElementModelCategories().pipe(
      reduce(
        (acc, queriedCategory) => {
          acc.allCategories.add(queriedCategory.categoryId);
          const categoryModelsEntry = getOrCreate({
            map: acc.categoryModelsInfo,
            key: queriedCategory.categoryId,
            createFunc: () => new Array<{ id: ModelId; categoryIsOfTopMostElement: boolean }>(),
          });
          categoryModelsEntry.push({
            id: queriedCategory.modelId,
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
          categoryModelsInfo: new Map<CategoryId, Array<{ id: ModelId; categoryIsOfTopMostElement: boolean }>>(),
        },
      ),
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
}
