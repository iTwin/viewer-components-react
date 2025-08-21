/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useRef } from "react";
import { HierarchyFilteringPath, HierarchyNodeIdentifier } from "@itwin/presentation-hierarchies";

import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { HierarchyFilteringPathOptions, HierarchyNodeIdentifiersPath } from "@itwin/presentation-hierarchies";

/** @beta */
export type FunctionProps<THook extends (props: any) => any> = Parameters<THook>[0];

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

/** @public */
export type NormalizedHierarchyFilteringPath = ReturnType<(typeof HierarchyFilteringPath)["normalize"]>;

/** @internal */
export function joinHierarchyFilteringPaths(subTreePaths: HierarchyNodeIdentifiersPath[], filteringPaths: NormalizedHierarchyFilteringPath[]): NormalizedHierarchyFilteringPath[] {
  const result = new Array<NormalizedHierarchyFilteringPath>();
  const filteringPathsToIncludeIndexes = new Set<number>();

  subTreePaths.forEach((subTreePath) => {
    let options: HierarchyFilteringPathOptions | undefined;
    let addSubTreePathToResult = false;

    for (let i = 0; i < filteringPaths.length; ++i) {
      const filteringPath = filteringPaths[i];
      if (filteringPath.path.length === 0) {
        continue;
      }

      for (let j = 0; j < subTreePath.length; ++j) {
        const identifier = subTreePath[j];
        if (filteringPath.path.length <= j || !HierarchyNodeIdentifier.equal(filteringPath.path[j], identifier)) {
          break;
        }

        // filtering paths that are shorter or equal than subTree paths length don't need to be added to the result
        if (filteringPath.path.length === j + 1) {
          addSubTreePathToResult = true;
          // If filtering path has autoExpand set to true, it means that we should expand only to the targeted filtered node
          // This is done by setting depthInPath
          options =
            filteringPath.options?.autoExpand !== true
              ? HierarchyFilteringPath.mergeOptions(options, filteringPath.options)
              : { autoExpand: { depthInPath: filteringPath.path.length } };
          break;
        }

        // filtering paths that are longer than subTree paths need to be added to the result
        if (subTreePath.length === j + 1) {
          addSubTreePathToResult = true;
          filteringPathsToIncludeIndexes.add(i);
        }
      }
    }

    if (addSubTreePathToResult) {
      result.push({
        path: subTreePath,
        options,
      });
    }
  });
  for (const index of filteringPathsToIncludeIndexes) {
    result.push(filteringPaths[index]);
  }
  return result;
}
