/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { bufferCount, concatAll, concatMap, delay, of } from "rxjs";

import type { Observable } from "rxjs";

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
export type ChildrenTree<T extends object> = Map<string, T & { children?: ChildrenTree<T> }>;

/** @internal */
export function getIdsFromChildrenTree<T extends object>({
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
