/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useState } from "react";
import { catchError, EMPTY } from "rxjs";

import type { Observable } from "rxjs";

/**
 * A hook that helps components throw errors in React's render loop so they can be captured by React error
 * boundaries.
 *
 * Usage: simply call the returned function with an error and it will be re-thrown in React render loop.
 *
 * @internal
 */
export function useErrorState() {
  const [_, setError] = useState(undefined);
  const setErrorState = useCallback((e: unknown) => {
    setError(() => {
      throw e instanceof Error ? e : /* c8 ignore next */ new Error();
    });
  }, []);
  return setErrorState;
}

/** @internal */
export function isBeSqliteInterruptError(error: unknown): boolean {
  return typeof error === "object" && !!error && "name" in error && error.name === "BE_SQLITE_INTERRUPT";
}

/** @internal */
export function catchBeSQLiteInterrupts<T>(obs: Observable<T>): Observable<T> {
  return obs.pipe(
    catchError((error) => {
      if (isBeSqliteInterruptError(error)) {
        return EMPTY;
      }
      throw error;
    }),
  );
}
