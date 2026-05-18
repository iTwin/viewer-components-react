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
 * Subclasses define:
 * - How requests map to cached values
 * - How batches are built from requests
 * - How to produce query items from a batch, execute queries, and cache rows
 *
 * @internal
 */
export abstract class BatchingCache<TRequest, TBatch, TResult, TItem, TRow> {
  // When a new request is made:
  // - If the value is already cached, returns it immediately.
  // - If it's already in-flight (#requestedValues), subscribes to the same observable.
  // - Otherwise, adds to #valuesToRequest. After timer fires, the batch executes and caches results.

  #valuesToRequest: { values: TBatch; sharedObs: Observable<void> } | undefined;
  #requestedValues = new Map<RequestId, { values: TBatch; sharedObs: Observable<void> }>();
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

  /** Return the result from cache. Called after the batch observable has completed - value is guaranteed to be cached. */
  protected abstract getGuaranteedCachedValue(request: TRequest): TResult;

  /**
   * Return the portion of the request which needs to be requested (not in batch or cache).
   * Returns `undefined` if the entire request is already in the batch.
   * For caches without partial requests, return `undefined` if in batch, or the full request if not.
   */
  protected abstract getValuesNotInBatch(
    request: TRequest,
    batch: TBatch,
  ): { valuesNotInBatch: TRequest; batchContainsValues: boolean } | { valuesNotInBatch: undefined; batchContainsValues: true };

  /** Create a new empty batch. */
  protected abstract createBatch(): TBatch;

  /** Add a request to an existing batch. */
  protected abstract addRequestToBatch(request: TRequest, batch: TBatch): void;

  /** Produce the items from a batch that will be buffered and passed to `executeQuery`. */
  protected abstract getIterable(batch: TBatch): Observable<TItem>;

  /** Execute a query for a buffer of items. Returns an observable of result rows. */
  protected abstract executeQuery(items: TItem[]): Observable<TRow>;

  /** Cache a single row returned by `executeQuery`. */
  protected abstract insertRow(row: TRow): void;

  /** Ensure default/empty cache entries exist for all values in the batch (called after query completes). */
  protected abstract ensureDefaultCacheEntries(batch: TBatch): void;

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
      this.#valuesToRequest = { values: this.createBatch(), sharedObs };
      this.addRequestToBatch(requestNotInBatch, this.#valuesToRequest.values);
      // Some values might be requested in sharedObsArray while waiting for the timer, so merge those in as well
      return this.getResultAfterObservable(request, merge(...[...sharedObsArray, this.#valuesToRequest.sharedObs]).pipe(last()));
    }

    this.addRequestToBatch(requestNotInBatch, this.#valuesToRequest.values);
    // Some values might be requested in sharedObsArray while waiting for the timer, so merge those in as well
    return this.getResultAfterObservable(request, merge(...[...sharedObsArray, this.#valuesToRequest.sharedObs]).pipe(last()));
  }

  private executeBatchQuery(batch: TBatch): Observable<TRow> {
    return this.getIterable(batch).pipe(
      bufferCount(this.#bufferSize),
      mergeMap((items: TItem[]) => this.executeQuery(items).pipe(catchBeSQLiteInterrupts)),
      releaseMainThreadOnItemsCount(this.#releaseOnCount),
    );
  }

  private getResultAfterObservable(request: TRequest, observable: Observable<void>): Observable<TResult> {
    return observable.pipe(map(() => this.getGuaranteedCachedValue(request)));
  }
}
