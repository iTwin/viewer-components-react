/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { bufferCount, last, map, merge, mergeMap, of, reduce, shareReplay, switchMap, tap, timer } from "rxjs";
import { assert, Guid } from "@itwin/core-bentley";
import { catchBeSQLiteInterrupts } from "../UseErrorState.js";
import { releaseMainThreadOnItemsCount } from "../Utils.js";

import type { Observable } from "rxjs";

type RequestId = string;

/** @internal */
export interface BatchingCacheProps {
  /** Number of items to buffer before executing a query. Defaults to 100. */
  bufferSize?: number;
  /** Time in ms to wait before firing the batch. Defaults to 20 ms. */
  timerDelay?: number;
  /** Release main thread after this many items from the query. Defaults to 500. */
  releaseOnCount?: number;
}

/**
 * Abstract base class that provides timer-based batching, deduplication, and caching.
 *
 * @template TRequest - A single logical request made by a consumer (e.g. `{ modelId, categoryId, parentElementId }`).
 * @template TResult - The value returned to the consumer for a given request (e.g. `Id64Array`).
 * @template TQueryData - Query data produced by decomposing a batch of requests via `getQueryData`
 *   (e.g. a WHERE clause fragment). Items are buffered (up to `bufferSize`) and passed to `executeQuery`.
 * @template TRow - A single result row emitted by `executeQuery`, cached via `insertRow`
 *   (e.g. `{ modelId, reqParent, reqCategory, ownCategory, count }`).
 *
 * Pipeline:
 * 1. Requests arriving within `timerDelay` ms are collected into a batch (`TRequest[]`).
 * 2. `getQueryData(batch)` decomposes the batch into a stream of `TQueryData` items.
 * 3. Items are buffered (up to `bufferSize`) and passed to `executeQuery(items)`.
 * 4. Each `TRow` emitted by `executeQuery` is cached via `insertRow`.
 * 5. After completion, `ensureDefaultCacheEntries` fills in empty entries for
 *    requests that produced no rows, and `getCachedValue` returns the result.
 *
 * @internal
 */
export abstract class BatchingCache<TRequest, TResult, TQueryData, TRow> {
  // When a new request is made:
  // - If the value is already cached, returns it immediately.
  // - If it's already in-flight (#requestedValues), subscribes to the same observable.
  // - Otherwise, adds to #valuesToRequest. After timer fires, the batch executes and caches results.

  #valuesToRequest: { values: TRequest[]; sharedObs: Observable<void> } | undefined;
  #requestedValues = new Map<RequestId, { values: TRequest[]; sharedObs: Observable<void> }>();
  #bufferSize: number;
  #timerDelay: number;
  #releaseOnCount: number;

  protected constructor(props?: BatchingCacheProps) {
    this.#bufferSize = props?.bufferSize ?? 100;
    this.#timerDelay = props?.timerDelay ?? 20;
    this.#releaseOnCount = props?.releaseOnCount ?? 500;
  }

  /** Return the cached result if available, or `undefined` if not cached. */
  protected abstract getCachedValue(request: TRequest): TResult | undefined;

  /**
   * Return the portion of the request which needs to be requested (not in batch or cache).
   * Returns `undefined` if the entire request is already in the batch.
   * For caches without partial requests, return `undefined` if in batch, or the full request if not.
   */
  protected abstract getValuesNotInBatch(
    request: TRequest,
    batch: TRequest[],
  ): { valuesNotInBatch: TRequest; batchContainsValues: boolean } | { valuesNotInBatch: undefined; batchContainsValues: true };

  /**
   * Convert batched requests into units of data which are used to execute the query.
   * For example, TRequest might be an object containing various request values, when converted to TQueryData,
   * those values take shape of a WHERE clause fragments.
   * These TQueryData items are buffered and passed to `executeQuery`.
   */
  protected abstract getQueryData(batch: TRequest[]): Observable<TQueryData>;

  /** Execute a query for the given query data buffer. Returns an observable of result rows. */
  protected abstract executeQuery(queryData: TQueryData[]): Observable<TRow>;

  /** Cache a single row returned by `executeQuery`. */
  protected abstract insertRow(row: TRow): void;

  /** Ensure default/empty cache entries exist for all values in the batch (called after query completes). */
  protected abstract ensureDefaultCacheEntries(batch: TRequest[]): void;

  public get(request: TRequest): Observable<TResult> {
    const cachedValue = this.getCachedValue(request);
    if (cachedValue !== undefined) {
      return of(cachedValue);
    }

    // Check if request is fully covered by an in-flight batch
    let requestNotInBatch: TRequest = request;
    const sharedObsArray: Array<Observable<void>> = [];
    for (const { values, sharedObs } of this.#requestedValues.values()) {
      const { valuesNotInBatch, batchContainsValues } = this.getValuesNotInBatch(requestNotInBatch, values);
      if (batchContainsValues) {
        sharedObsArray.push(sharedObs);
      }
      if (valuesNotInBatch === undefined) {
        return this.getResultAfterObservable(request, merge(...sharedObsArray).pipe(last()));
      }
      requestNotInBatch = valuesNotInBatch;
    }

    if (this.#valuesToRequest === undefined) {
      const requestId = Guid.createValue();
      const sharedObs = timer(this.#timerDelay).pipe(
        switchMap(() => {
          assert(this.#valuesToRequest !== undefined);
          // After timer delay ms, assign the observable in #valuesToRequest to the #requestedValues
          const valuesToRequest = this.#valuesToRequest;
          this.#requestedValues.set(requestId, valuesToRequest);
          // Clear #valuesToRequest so new requests can be collected while the query is executing
          this.#valuesToRequest = undefined;
          return this.executeBatchQuery(valuesToRequest.values).pipe(
            reduce((_acc, row: TRow) => {
              // Cache each row as it arrives, use reduce to emit one value when query completes
              this.insertRow(row);
              return undefined;
            }, undefined),
            tap(() => {
              this.ensureDefaultCacheEntries(valuesToRequest.values);
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
      this.#valuesToRequest = { values: [requestNotInBatch], sharedObs };
      // Some values might be requested in sharedObsArray while waiting for the timer, so merge those in as well
      return this.getResultAfterObservable(request, merge(...[...sharedObsArray, this.#valuesToRequest.sharedObs]).pipe(last()));
    }

    this.#valuesToRequest.values.push(requestNotInBatch);
    // Some values might be requested in sharedObsArray while waiting for the timer, so merge those in as well
    return this.getResultAfterObservable(request, merge(...[...sharedObsArray, this.#valuesToRequest.sharedObs]).pipe(last()));
  }

  private executeBatchQuery(batch: TRequest[]): Observable<TRow> {
    return this.getQueryData(batch).pipe(
      bufferCount(this.#bufferSize),
      mergeMap((queryData: TQueryData[]) => this.executeQuery(queryData).pipe(catchBeSQLiteInterrupts)),
      releaseMainThreadOnItemsCount(this.#releaseOnCount),
    );
  }

  private getResultAfterObservable(request: TRequest, observable: Observable<void>): Observable<TResult> {
    return observable.pipe(
      map(() => {
        const cachedValue = this.getCachedValue(request);
        assert(cachedValue !== undefined);
        return cachedValue;
      }),
    );
  }
}
