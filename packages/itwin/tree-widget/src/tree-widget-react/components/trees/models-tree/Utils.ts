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
export type ChildrenTree<T> = Map<string, { children?: ChildrenTree<T>; additionalProps?: T }>;

/** @internal */
export function getIdsFromChildrenTree<T>({
  tree,
  additionalCheck,
}: {
  tree: ChildrenTree<T>;
  additionalCheck?: (treeEntry: T | undefined) => boolean;
}): Set<string> {
  const result = new Set<string>();
  tree.forEach((entry, id) => {
    if (!additionalCheck || additionalCheck(entry.additionalProps)) {
      result.add(id);
    }
    if (entry.children) {
      const childrenIds = getIdsFromChildrenTree({ tree: entry.children, additionalCheck });
      childrenIds.forEach((childId) => result.add(childId));
    }
  });
  return result;
}

/** @internal */
export function getChildIdsFromChildrenTree<T>({
  tree,
  additionalCheck,
}: {
  tree: ChildrenTree<T>;
  additionalCheck?: (treeEntry: T | undefined) => boolean;
}): Set<string> {
  const result = new Set<string>();
  tree.forEach((entry) => {
    if (entry.children) {
      const childrenIds = getIdsFromChildrenTree({ tree: entry.children, additionalCheck });
      childrenIds.forEach((childId) => result.add(childId));
    }
  });
  return result;
}
