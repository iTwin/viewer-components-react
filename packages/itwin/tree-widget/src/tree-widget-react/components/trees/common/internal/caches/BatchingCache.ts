/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { bufferCount, forkJoin, fromEventPattern, map, mergeMap, of, reduce, switchMap, take, tap, timer } from "rxjs";
import { assert, BeEvent, Guid } from "@itwin/core-bentley";
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
  // When a new request is made via `get`:
  // - If the value is already cached, returns it immediately.
  // - If it's already in-flight (#requestedValues), subscribes to the same completion event.
  // - Otherwise, adds to #valuesToRequest. A timer is started if not already running;
  //   after the timer fires, the batch executes and caches results.

  /** Pending requests buffer. `event` is created lazily on the first `get` call of each batch cycle. */
  #valuesToRequest: { values: TRequest[]; event?: BeEvent<() => void> } = { values: [] };
  #requestedValues = new Map<RequestId, { values: TRequest[]; event: BeEvent<() => void> }>();
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
   * Return the portion of the request not already covered by the given set of values.
   * Returns `undefined` for `valuesNotInBatch` if the request is fully covered.
   * For caches without partial requests, return `undefined` if covered, or the full request otherwise.
   */
  protected abstract getValuesNotInBatch(
    request: TRequest,
    batch: TRequest[],
  ): { valuesNotInBatch: TRequest; batchContainsValues: boolean } | { valuesNotInBatch: undefined; batchContainsValues: true };

  /**
   * Convert batched requests into query data items.
   * For example, TRequest might be an object containing various request values; when converted to TQueryData,
   * those values take the shape of WHERE clause fragments.
   * The resulting items are buffered (up to `bufferSize`) and passed to `executeQuery`.
   */
  protected abstract getQueryData(batch: TRequest[]): Observable<TQueryData>;

  /** Execute a query for the given query data buffer. Returns an observable of result rows. */
  protected abstract executeQuery(queryData: TQueryData[]): Observable<TRow>;

  /** Cache a single row returned by `executeQuery`. */
  protected abstract insertRow(row: TRow): void;

  /** Ensure default/empty cache entries exist for all values in the batch (called after query completes). */
  protected abstract ensureDefaultCacheEntries(batch: TRequest[]): void;

  /**
   * Queues a request and returns an observable that emits the result once the batch query completes.
   * If no batch timer is running, creates one. The request is included in the current batch.
   */
  public get(request: TRequest): Observable<TResult> {
    const cachedValue = this.getCachedValue(request);
    if (cachedValue !== undefined) {
      return of(cachedValue);
    }

    // Check if request is fully covered by an in-flight batch
    let requestNotInBatch: TRequest = request;
    const events: Array<BeEvent<() => void>> = [];
    for (const { values, event } of this.#requestedValues.values()) {
      const { valuesNotInBatch, batchContainsValues } = this.getValuesNotInBatch(requestNotInBatch, values);
      if (batchContainsValues) {
        events.push(event);
      }
      if (valuesNotInBatch === undefined) {
        return this.getResultAfterEvents(request, events);
      }
      requestNotInBatch = valuesNotInBatch;
    }

    if (this.#valuesToRequest.event === undefined) {
      const requestId = Guid.createValue();
      const newEvent = new BeEvent<() => void>();
      this.#valuesToRequest.event = newEvent;
      this.scheduleBatchExecution({
        values: this.#valuesToRequest.values,
        onStart: () => {
          // Move the pending buffer into #requestedValues so in-flight lookups find it
          this.#requestedValues.set(requestId, { values: this.#valuesToRequest.values, event: newEvent });
          // Reset #valuesToRequest so new requests can be collected while the query is executing
          this.#valuesToRequest = { values: [] };
        },
        onDone: () => {
          newEvent.raiseEvent();
          newEvent.clear();
          this.#requestedValues.delete(requestId);
        },
      });
    }

    this.#valuesToRequest.values.push(requestNotInBatch);
    return this.getResultAfterEvents(request, [...events, this.#valuesToRequest.event]);
  }

  private scheduleBatchExecution({ values, onStart, onDone }: { values: TRequest[]; onStart: () => void; onDone: () => void }): void {
    timer(this.#timerDelay)
      .pipe(
        switchMap(() => {
          onStart();
          return this.executeBatchQuery(values).pipe(
            reduce((_acc, row: TRow) => {
              // Cache each row inside the reducer; reduce emits a single value once the query completes
              this.insertRow(row);
              return undefined;
            }, undefined),
            tap(() => {
              this.ensureDefaultCacheEntries(values);
            }),
          );
        }),
        tap({
          finalize: onDone,
        }),
      )
      .subscribe({
        error: () => {
          onDone();
        },
      });
  }

  private executeBatchQuery(batch: TRequest[]): Observable<TRow> {
    return this.getQueryData(batch).pipe(
      bufferCount(this.#bufferSize),
      mergeMap((queryData: TQueryData[]) => this.executeQuery(queryData).pipe(catchBeSQLiteInterrupts)),
      releaseMainThreadOnItemsCount(this.#releaseOnCount),
    );
  }

  private getResultAfterEvents(request: TRequest, events: Array<BeEvent<() => void>>): Observable<TResult> {
    return forkJoin(
      events.map((event) =>
        fromEventPattern((handler) => {
          event.addOnce(handler);
        }).pipe(take(1)),
      ),
    ).pipe(
      map(() => {
        const cachedValue = this.getCachedValue(request);
        assert(cachedValue !== undefined);
        return cachedValue;
      }),
    );
  }
}
