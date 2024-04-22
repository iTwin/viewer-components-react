/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defaultIfEmpty, find, from, isEmpty, last, map, mergeMap, of, reduce, scan, takeWhile } from "rxjs";

import type { Observable, ObservableInput, OperatorFunction } from "rxjs";

/**
 * Applies reduce function and "returns" early if the predicate returns `false` for the accumulator.
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
 * Applies logical AND to an observable.
 * @param rhs right side of logical AND.
 */
export function and(head: ObservableInput<boolean>, ...tail: ObservableInput<boolean>[]): Observable<boolean> {
  if (tail.length === 0) {
    return from(head);
  }

  return from(head).pipe(
    mergeMap((x) => {
      if (!x) {
        return of(false);
      }
      if (tail.length === 0) {
        return of(true);
      }
      return and(tail[0], ...tail.slice(1));
    }),
  );
}

/**
 * Creates an observable that emits `true` if the source observable contains
 * an element that matches the given predicate.
 */
export function some<T>(predicate: (x: T) => boolean): OperatorFunction<T, boolean> {
  return (obs) => {
    return obs.pipe(
      find(predicate),
      map((x) => x !== undefined),
      defaultIfEmpty(false),
    );
  };
}

/** Opposite of `isEmpty`. */
export function hasItems<T>(): OperatorFunction<T, boolean> {
  return (obs) => {
    return obs.pipe(
      isEmpty(),
      map((x) => !x),
    );
  };
}

type ValueOrCallback<T> = T extends (...args: any[]) => any ? never : T | (() => T);

/**
 * Converts Observable<T | undefined> to Observable<T> using a callback for default values.
 */
export function unwrap<T>(valuerOrCb: ValueOrCallback<T>): OperatorFunction<T | undefined, T> {
  return (obs) => {
    return obs.pipe(
      map((x) => {
        if (x === undefined) {
          return typeof valuerOrCb === "function" ? valuerOrCb() : valuerOrCb;
        }
        return x;
      }),
    );
  };
}

/** Collects elements to a set. */
export function toSet<T>(): OperatorFunction<T, Set<T>> {
  return (obs) => obs.pipe(reduce((set, x) => set.add(x), new Set()));
}

/** Same as `firstValueFrom` except it won't throw if the observable emits no values. */
export async function toVoidPromise(obs: Observable<void> | Observable<undefined>): Promise<void> {
  return new Promise((resolve, reject) => {
    obs.subscribe({
      next: resolve,
      complete: resolve,
      error: reject,
    });
  });
}
