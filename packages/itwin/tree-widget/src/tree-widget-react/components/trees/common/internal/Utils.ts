/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useRef } from "react";
import { bufferCount, concatAll, concatMap, delay, from, of } from "rxjs";
import { assert, Id64 } from "@itwin/core-bentley";
import { ProcessedHierarchyNode } from "@itwin/presentation-hierarchies";
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
export function getOptimalBatchSize({ totalSize, maximumBatchSize }: { totalSize: number; maximumBatchSize: number }): number {
  return Math.ceil(totalSize / Math.ceil(totalSize / maximumBatchSize));
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

/**
 * Creates an Observable from provided props. If `releaseOnCount` is provided, main thread will be released after processing specified number of items.
 * @internal
 */
export function fromWithRelease(props: { source: Id64Arg; releaseOnCount?: number }): Observable<Id64String>;
export function fromWithRelease<T>(props: { source: Set<T> | Array<T>; releaseOnCount?: number }): Observable<T>;
export function fromWithRelease(props: { source: Id64Arg | Set<unknown> | Array<unknown>; releaseOnCount?: number }): Observable<unknown> {
  const source = Array.isArray(props.source)
    ? { obs: from(props.source), size: props.source.length }
    : props.source instanceof Set
      ? { obs: from(props.source), size: props.source.size }
      : { obs: from(Id64.iterable(props.source)), size: Id64.sizeOf(props.source) };
  if (props.releaseOnCount === undefined || source.size < props.releaseOnCount) {
    return source.obs;
  }
  return source.obs.pipe(releaseMainThreadOnItemsCount(props.releaseOnCount));
}

/** @internal */
export type ChildrenTree<T extends object = {}> = Map<string, T & { children?: ChildrenTree<T> }>;

/** @internal */
export function getIdsFromChildrenTree<T extends object = {}>({
  tree,
  predicate,
}: {
  tree: ChildrenTree<T>;
  predicate?: (props: { depth: number; treeEntry: T }) => boolean;
}): Set<string> {
  function getIdsInternal({ childrenTree, depth }: { childrenTree: ChildrenTree<T>; depth: number }): Set<string> {
    const result = new Set<string>();
    childrenTree.forEach((entry, id) => {
      if (!predicate || predicate({ depth, treeEntry: entry })) {
        result.add(id);
      }
      if (entry.children) {
        const childrenIds = getIdsInternal({ childrenTree: entry.children, depth: depth + 1 });
        childrenIds.forEach((childId) => result.add(childId));
      }
    });
    return result;
  }
  return getIdsInternal({ childrenTree: tree, depth: 0 });
}

/**
 * Updates children tree with provided `idsToAdd`:
 * - All Ids are added (if they are not yet added) to children tree in the same order they appear in `idsToAdd` array.
 * - `T` is assigned to each entry using the `additionalPropsGetter` function.
 * @internal
 */
export function updateChildrenTree<T extends object = {}>({
  tree,
  additionalPropsGetter,
  idsToAdd,
}: {
  tree: ChildrenTree<T>;
  idsToAdd: Id64Array;
  additionalPropsGetter: (id: Id64String, additionalProps?: T) => T;
}) {
  let currentTree: ChildrenTree<T> = tree;
  for (let i = 0; i < idsToAdd.length; ++i) {
    const id = idsToAdd[i];
    let entry = currentTree.get(id);
    entry = {
      // Whoever calls this function knows how to assign the `T` to entry.
      ...additionalPropsGetter(id, entry),
      // If children already exists, we reuse it.
      // If children do not exist and there are still ids left in the `idsToAdd` array, create a new Map, it will have the next id.
      ...(entry?.children || i + 1 < idsToAdd.length ? { children: entry?.children ?? new Map() } : {}),
    };
    // Always update the set with updated entry.
    currentTree.set(id, entry);
    // This will only happen if it's the last id in `idsToAdd` array. In such case loop can be exited.
    if (!entry.children) {
      break;
    }
    currentTree = entry.children;
  }
}

/** @internal */
export function groupingNodeHasSearchTargets(children: ProcessedHierarchyNode[]):
  | {
      hasSearchTargetAncestor: true;
      hasDirectNonSearchTargets: undefined;
    }
  | {
      hasSearchTargetAncestor: false;
      hasDirectNonSearchTargets: boolean;
    } {
  for (const child of children) {
    assert(!ProcessedHierarchyNode.isGroupingNode(child), "Expected only non-grouping nodes as children");
    if (child.search) {
      if (child.search.hasSearchTargetAncestor) {
        return { hasSearchTargetAncestor: true, hasDirectNonSearchTargets: undefined };
      }
      if (!child.search.isSearchTarget) {
        return { hasSearchTargetAncestor: false, hasDirectNonSearchTargets: true };
      }
    }
  }

  return { hasSearchTargetAncestor: false, hasDirectNonSearchTargets: false };
}
