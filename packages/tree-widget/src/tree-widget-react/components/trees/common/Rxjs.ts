/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defaultIfEmpty, from, last, scan, takeWhile } from "rxjs";

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

/** Same as `firstValueFrom` except it won't throw if the observable emits no values. */
export async function toVoidPromise(obs: Observable<any>): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    obs.subscribe({
      complete: () => resolve(),
      error: reject,
    });
  });
}

/** Returns observable results in an array */
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
