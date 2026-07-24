/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { bufferCount, concatAll, concatMap, delay, map, of } from "rxjs";
import { reduceWhile } from "../Rxjs.js";
import { createVisibilityStatus } from "../Tooltip.js";

import type { Observable, OperatorFunction } from "rxjs";
import type { Visibility } from "../Tooltip.js";
import type { VisibilityStatus } from "../UseHierarchyVisibility.js";

/** @internal */
export function setDifference<T>(lhs: Readonly<Iterable<T>>, rhs: ReadonlySet<T>): Set<T> {
  const result = new Set<T>();
  for (const x of lhs) {
    if (!rhs.has(x)) {
      result.add(x);
    }
  }
  return result;
}

/** @internal */
export function setIntersection<T>(lhs: Readonly<Iterable<T>>, rhs: ReadonlySet<T>): Set<T> {
  const result = new Set<T>();
  for (const x of lhs) {
    if (rhs.has(x)) {
      result.add(x);
    }
  }
  return result;
}

/** @internal */
export function mergeVisibilities(obs: Observable<Visibility>): Observable<Visibility | "empty"> {
  return obs.pipe(
    reduceWhile(
      (x) => x.allVisible || x.allHidden,
      (acc, val) => {
        acc.allVisible &&= val === "visible";
        acc.allHidden &&= val === "hidden";
        return acc;
      },
      { allVisible: true, allHidden: true },
    ),
    map((x) => {
      if (!x) {
        return "empty";
      }
      return x.allVisible ? "visible" : x.allHidden ? "hidden" : "partial";
    }),
  );
}

/** @internal */
export function mergeVisibilityStatuses(
  tooltipMap?: { [key in Visibility]: string | undefined },
  ignoreTooltip?: boolean,
): OperatorFunction<VisibilityStatus, VisibilityStatus> {
  return (obs) => {
    return obs.pipe(
      map((visibilityStatus) => visibilityStatus.state),
      mergeVisibilities,
      map((visibility) => {
        if (visibility === "empty") {
          visibility = "visible";
        }
        return createVisibilityStatus(visibility, getTooltipOptions(tooltipMap?.[visibility], ignoreTooltip));
      }),
    );
  };
}

/** @internal */
export function getTooltipOptions(key: string | undefined, ignoreTooltip?: boolean) {
  return {
    useTooltip: ignoreTooltip ? (false as const) : key,
  };
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

/** @internal */
export function getOptimalBatchSize({ totalSize, maximumBatchSize }: { totalSize: number; maximumBatchSize: number }): number {
  return Math.ceil(totalSize / Math.ceil(totalSize / maximumBatchSize));
}
