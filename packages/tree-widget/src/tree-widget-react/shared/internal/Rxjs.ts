/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { bufferCount, concatAll, concatMap, defaultIfEmpty, delay, from, last, mergeMap, Observable, of, scan, takeWhile } from "rxjs";
import { Id64 } from "@itwin/core-bentley";
import { getOptimalBatchSize } from "./Utils.js";

import type { ObservableInput, OperatorFunction, Subscription } from "rxjs";
import type { Id64Arg, Id64String } from "@itwin/core-bentley";

/**
 * Applies reduce function and "returns" early if the predicate returns `false` for the accumulator.
 * @internal
 */
export function reduceWhile<TValue, TAccumulator>(
  predicate: (x: TAccumulator) => boolean,
  reduceFunc: (acc: TAccumulator, val: TValue) => TAccumulator,
  initial: TAccumulator,
): OperatorFunction<TValue, TAccumulator | undefined> {
  return (obs) => {
    return obs.pipe(scan(reduceFunc, initial), takeWhile(predicate, true), defaultIfEmpty(undefined), last());
  };
}

/**
 * Same as `firstValueFrom` except it won't throw if the observable emits no values.
 * @internal
 */
export async function toVoidPromise(obs: Observable<any>): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    obs.subscribe({
      complete: () => resolve(),
      error: reject,
    });
  });
}

/**
 * Returns observable results in an array
 * @internal
 */
export async function collect<T>(obs: ObservableInput<T>): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const arr = new Array<T>();
    from(obs).subscribe({
      next(item: T) {
        arr.push(item);
      },
      complete() {
        resolve(arr);
      },
      error(reason) {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        reject(reason);
      },
    });
  });
}

/**
 * Subscribes to observables for each ID and emits `{ sourceId, result }` for each value.
 * If the total number of IDs exceeds `batchSize`, subscriptions are split into batches
 * processed sequentially via `concatMap` with a main-thread yield between them.
 * Uses a plain array for subscription tracking instead of RxJS's parent-child mechanism,
 * avoiding O(n^2) `arrRemove` overhead when many inner observables complete simultaneously.
 * @internal
 */
export function subscribeAll<TResult>({
  ids,
  getObservable,
  batchSize = 10_000,
}: {
  ids: Id64Arg;
  getObservable: (id: Id64String) => Observable<TResult>;
  batchSize?: number;
}): Observable<{ sourceId: Id64String; result: TResult }> {
  const totalSize = Id64.sizeOf(ids);
  if (totalSize < batchSize) {
    return subscribeAllBatch({ ids, getObservable });
  }
  return from(Id64.iterable(ids)).pipe(
    bufferCount(getOptimalBatchSize({ totalSize, maximumBatchSize: batchSize })),
    concatMap((batch) => {
      return of(undefined).pipe(
        delay(0),
        mergeMap(() => subscribeAllBatch({ ids: batch, getObservable })),
      );
    }),
  );
}

function subscribeAllBatch<TResult>({
  ids,
  getObservable,
}: {
  ids: Id64Arg;
  getObservable: (id: Id64String) => Observable<TResult>;
}): Observable<{ sourceId: Id64String; result: TResult }> {
  return new Observable((subscriber) => {
    let completed = 0;
    const total = Id64.sizeOf(ids);
    if (total === 0) {
      subscriber.complete();
      return;
    }
    const subscriptions: Subscription[] = [];
    for (const id of Id64.iterable(ids)) {
      const sub = getObservable(id).subscribe({
        next: (result) => subscriber.next({ sourceId: id, result }),
        error: (e) => subscriber.error(e),
        complete: () => {
          ++completed;
          if (completed === total) {
            subscriber.complete();
          }
        },
      });
      subscriptions.push(sub);
    }
    return () => {
      for (const sub of subscriptions) {
        sub.unsubscribe();
      }
    };
  });
}

/** @internal */
export function releaseMainThreadOnItemsCount<T>(elementCount: number) {
  return (obs: Observable<T>): Observable<T> => {
    return obs.pipe(
      bufferCount(elementCount),
      concatMap((buff, i) => {
        const out = of(buff);
        if (i === 0 && buff.length < elementCount) {
          return out;
        }
        return out.pipe(delay(0));
      }),
      concatAll(),
    );
  };
}

/**
 * Creates an Observable from provided props. If `releaseOnCount` is provided, main thread will be released after processing specified number of items.
 * @internal
 */
export function fromWithRelease(props: { source: Id64Arg; releaseOnCount?: number }): Observable<Id64String>;
export function fromWithRelease<T>(props: ({ source: Set<T> | Array<T> } | { source: Iterable<T>; size: number }) & { releaseOnCount?: number }): Observable<T>;
export function fromWithRelease(props: {
  source: Id64Arg | Set<unknown> | Array<unknown> | Iterable<unknown>;
  size?: number;
  releaseOnCount?: number;
}): Observable<unknown> {
  const source = Array.isArray(props.source)
    ? { obs: from(props.source), size: props.source.length }
    : props.source instanceof Set
      ? { obs: from(props.source), size: props.source.size }
      : typeof props.source === "string"
        ? { obs: from(Id64.iterable(props.source)), size: Id64.sizeOf(props.source) }
        : { obs: from(props.source), size: props.size! };
  if (props.releaseOnCount === undefined || source.size < props.releaseOnCount) {
    return source.obs;
  }
  return source.obs.pipe(releaseMainThreadOnItemsCount(props.releaseOnCount));
}
