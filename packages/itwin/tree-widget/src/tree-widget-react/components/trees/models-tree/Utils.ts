/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { bufferCount, concatAll, concatMap, delay, of } from "rxjs";

import type { Observable } from "rxjs";
import type { Id64Array, Id64String } from "@itwin/core-bentley";

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
