/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defaultIfEmpty, find, from, last, map, mergeMap, of, scan, takeWhile } from "rxjs";

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
