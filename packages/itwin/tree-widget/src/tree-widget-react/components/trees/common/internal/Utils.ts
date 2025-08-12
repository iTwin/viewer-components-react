/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useRef } from "react";
import { bufferCount, concatAll, concatMap, delay, of } from "rxjs";
import { Id64 } from "@itwin/core-bentley";
import {
  CLASS_NAME_DrawingCategory,
  CLASS_NAME_GeometricElement2d,
  CLASS_NAME_GeometricElement3d,
  CLASS_NAME_GeometricModel2d,
  CLASS_NAME_GeometricModel3d,
  CLASS_NAME_SpatialCategory,
} from "./ClassNameDefinitions.js";

import type { Observable } from "rxjs";
import type { Id64Arg, Id64Array, Id64String } from "@itwin/core-bentley";

/** @internal */
export function setDifference<T>(lhs: Iterable<T>, rhs: Set<T>): Set<T> {
  const result = new Set<T>();
  for (const x of lhs) {
    if (!rhs.has(x)) {
      result.add(x);
    }
  }
  return result;
}

/** @internal */
export function setIntersection<T>(lhs: Iterable<T>, rhs: Set<T>): Set<T> {
  const result = new Set<T>();
  for (const x of lhs) {
    if (rhs.has(x)) {
      result.add(x);
    }
  }
  return result;
}

/** @internal */
export function getDistinctMapValues(map: Map<any, Array<string> | Set<string>>): Set<string> {
  const result = new Set<string>();
  for (const values of map.values()) {
    values.forEach((value) => result.add(value));
  }
  return result;
}

/** @internal */
export function createIdsSelector(ids: Id64Array): string {
  // Note: `json_array` function only accepts up to 127 arguments and we may have more `ids` than that. As a workaround,
  // we're creating an array of arrays
  const slices = new Array<Id64String[]>();
  for (let sliceStartIndex = 0; sliceStartIndex < ids.length; sliceStartIndex += 127) {
    let sliceEndIndex: number | undefined = sliceStartIndex + 127;
    if (sliceEndIndex > ids.length) {
      sliceEndIndex = undefined;
    }
    slices.push(ids.slice(sliceStartIndex, sliceEndIndex));
  }
  return `json_array(${slices.map((sliceIds) => `json_array(${sliceIds.map((id) => `'${id}'`).join(",")})`).join(",")})`;
}

/** @internal */
export function parseIdsSelectorResult(selectorResult: any): Id64Array {
  if (!Array.isArray(selectorResult)) {
    return [];
  }
  return selectorResult.reduce((arr, ids: Id64String | Id64String[]) => [...arr, ...(Array.isArray(ids) ? ids : [ids])], new Array<Id64String>());
}

/** @internal */
export function pushToMap<TKey, TValue>(targetMap: Map<TKey, Set<TValue>>, key: TKey, value: TValue) {
  let set = targetMap.get(key);
  if (!set) {
    set = new Set();
    targetMap.set(key, set);
  }
  set.add(value);
}

/** @internal */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

/**
 * Checks if all given models are displayed in given viewport.
 * @internal
 */
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

/** @internal */
export function getClassesByView(viewType: "2d" | "3d") {
  return viewType === "2d"
    ? ({ categoryClass: CLASS_NAME_DrawingCategory, elementClass: CLASS_NAME_GeometricElement2d, modelClass: CLASS_NAME_GeometricModel2d } as const)
    : ({ categoryClass: CLASS_NAME_SpatialCategory, elementClass: CLASS_NAME_GeometricElement3d, modelClass: CLASS_NAME_GeometricModel3d } as const);
}

/** @internal */
export function joinId64Arg(arg: Id64Arg, separator: string): string {
  let joined = "";
  for (const argItem of Id64.iterable(arg)) {
    if (joined !== "") {
      joined += separator;
    }

    joined += argItem;
  }
  return joined;
}

/** @internal */
export function getSetFromId64Arg(arg: Id64Arg): Set<Id64String> {
  return typeof arg === "string" ? new Set([arg]) : Array.isArray(arg) ? new Set(arg) : arg;
}
