/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { bufferCount, defer, from, map, mergeMap, of, reduce, shareReplay, switchMap, tap, timer } from "rxjs";
import { assert, Guid } from "@itwin/core-bentley";
import { catchBeSQLiteInterrupts } from "../UseErrorState.js";
import { releaseMainThreadOnItemsCount } from "../Utils.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { CategoryId, ModelId } from "../Types.js";

type RequestId = string;

/**
 * Cache used to store count of elements under root categories.
 *
 * Cache makes requests in batches of 20ms.
 * @internal
 */
export class ModelCategoryElementsCountCache {
  // When a new request is made:
  // - If the value is already cached (#cachedValues), returns it.
  // - If it's already requested (#requestedValues), pipe through the observable. When observable emits, the cached value can be retrieved,
  // - If the value is not requested yet, add it to the values which will be requested (#valuesToRequest).
  // #valuesToRequest observable waits for 20ms, then adds the observable value to #requestedValues and starts the query.
  // When the query completes the observable removes the value from #requestedValues.

  #cachedValues = new Map<ModelId, Map<CategoryId, number>>();
  #valuesToRequest: { values: Map<ModelId, Set<CategoryId>>; sharedObs: Observable<void> } | undefined;
  #requestedValues = new Map<RequestId, { values: Map<ModelId, Set<CategoryId>>; sharedObs: Observable<void> }>();
  #queryExecutor: LimitingECSqlQueryExecutor;
  #elementClassName: string;
  #componentId: GuidString;
  #componentName: string;

  public constructor(props: { queryExecutor: LimitingECSqlQueryExecutor; elementClassName: string; componentId: GuidString }) {
    this.#componentId = props.componentId;
    this.#queryExecutor = props.queryExecutor;
    this.#elementClassName = props.elementClassName;
    this.#componentName = "ModelCategoryElementsCountCache";
  }

  private getCachedValueAfterObservable({
    modelId,
    categoryId,
    observable,
  }: {
    modelId: ModelId;
    categoryId: CategoryId;
    observable: Observable<void>;
  }): Observable<number> {
    return observable.pipe(
      map(() => {
        const entry = this.#cachedValues.get(modelId)?.get(categoryId);
        assert(entry !== undefined);
        return entry;
      }),
    );
  }

  private executeBatchQuery(valuesToRequest: Map<ModelId, Set<CategoryId>>) {
    return from(valuesToRequest.entries()).pipe(
      map(([modelId, categoryIds]) => `Model.Id = ${modelId} AND Category.Id IN (${[...categoryIds].join(", ")})`),
      // we may have thousands of where clauses here, and sending a single query with all of them could take a
      // long time - instead, split it into smaller chunks
      bufferCount(100),
      mergeMap((whereClauses) =>
        defer(() =>
          this.#queryExecutor.createQueryReader(
            {
              ctes: [
                `
                CategoryElements(id, modelId, categoryId) AS (
                  SELECT ECInstanceId, Model.Id, Category.Id
                  FROM ${this.#elementClassName}
                  WHERE
                    Parent.Id IS NULL
                    AND (
                      ${whereClauses.join(" OR ")}
                    )

                  UNION ALL

                  SELECT c.ECInstanceId, p.modelId, p.categoryId
                  FROM ${this.#elementClassName} c
                  JOIN CategoryElements p ON c.Parent.Id = p.id
                )
              `,
              ],
              ecsql: `
              SELECT modelId, categoryId, COUNT(id) elementsCount
              FROM (SELECT * FROM CategoryElements)
              GROUP BY modelId, categoryId
            `,
            },
            {
              rowFormat: "ECSqlPropertyNames",
              limit: "unbounded",
              restartToken: `${this.#componentName}/${this.#componentId}/category-element-counts/${Guid.createValue()}`,
            },
          ),
        ).pipe(catchBeSQLiteInterrupts),
      ),
      releaseMainThreadOnItemsCount(500),
    );
  }

  public getCategoryElementsCount({ modelId, categoryId }: { modelId: Id64String; categoryId: Id64String }): Observable<number> {
    const cachedValue = this.#cachedValues.get(modelId)?.get(categoryId);
    // Cached values can be returned immediately
    if (cachedValue !== undefined) {
      return of(cachedValue);
    }

    // Check if value was already requested. If it was, wait for requested observable to emit and then return the value from cache
    for (const { values, sharedObs: obs } of this.#requestedValues.values()) {
      if (values.get(modelId)?.has(categoryId)) {
        return this.getCachedValueAfterObservable({ modelId, categoryId, observable: obs });
      }
    }

    if (this.#valuesToRequest === undefined) {
      // Store request guid so it can be deleted later.
      const requestId = Guid.createValue();
      const sharedObs = timer(20).pipe(
        switchMap(() => {
          assert(this.#valuesToRequest !== undefined);
          // After 20 ms, assign the observable in #valuesToRequest to the #requestedValues
          const valuesToRequest = this.#valuesToRequest;
          this.#requestedValues.set(requestId, valuesToRequest);
          // Clear #valuesToRequest so new requests can be collected while the query is executing
          this.#valuesToRequest = undefined;
          return this.executeBatchQuery(valuesToRequest.values).pipe(
            // Cache each row as it arrives, use reduce to emit one value when query completes
            reduce((acc, row) => {
              const modelEntry = this.#cachedValues.get(modelId);
              if (modelEntry) {
                modelEntry.set(row.categoryId, row.elementsCount);
              } else {
                this.#cachedValues.set(row.modelId, new Map([[row.categoryId, row.elementsCount]]));
              }
              return acc;
            }, undefined),
            tap(() => {
              for (const [entryModelId, entryCategoryIds] of valuesToRequest.values.entries()) {
                let modelEntry = this.#cachedValues.get(entryModelId);
                if (!modelEntry) {
                  modelEntry = new Map();
                  this.#cachedValues.set(entryModelId, modelEntry);
                }
                for (const entryCategoryId of entryCategoryIds) {
                  // Make sure that all requested categories have an entry in the cache
                  if (!modelEntry.has(entryCategoryId)) {
                    modelEntry.set(entryCategoryId, 0);
                  }
                }
              }
            }),
          );
        }),
        tap({
          finalize: () => {
            // Remove requestedValues entry when the query completes.
            this.#requestedValues.delete(requestId);
          },
        }),
        shareReplay(1),
      );
      this.#valuesToRequest = { values: new Map([[modelId, new Set([categoryId])]]), sharedObs };
      return this.getCachedValueAfterObservable({ modelId, categoryId, observable: this.#valuesToRequest.sharedObs });
    }

    let categoryIds = this.#valuesToRequest.values.get(modelId);
    if (!categoryIds) {
      categoryIds = new Set([categoryId]);
      this.#valuesToRequest.values.set(modelId, categoryIds);
    } else {
      categoryIds.add(categoryId);
    }

    return this.getCachedValueAfterObservable({ modelId, categoryId, observable: this.#valuesToRequest.sharedObs });
  }
}
