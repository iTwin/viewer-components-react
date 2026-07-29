/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { useMemo, useRef } from "react";
import { pick } from "lodash";

// Workaround for github.com/TanStack/query/issues/5137. Will be removed when updating to the latest version of react-query and React 18.
function shallowCompareObjects<T extends { [key: string]: any }>(a: T, b: T): boolean {
  return Object.keys(a).every((key) => a[key] === b[key]);
}

function shallowCompareCollections<T extends {}>(a: T[], b: T[]) {
  return a.length === b.length && a.every((item, index) => shallowCompareObjects(item, b[index]));
}

export function useMemoizedCollectionPick<T extends {}, P extends keyof T>(array: T[], pickValue: readonly P[]): Pick<T, P>[] {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stablePickValue = useMemo(() => pickValue, [JSON.stringify(pickValue)]);
  const value = useMemo(() => array.map((item) => pick(item, stablePickValue)), [array, stablePickValue]);
  const prevValue = useRef(value);
  return useMemo(() => {
    if (shallowCompareCollections(value, prevValue.current)) {
      return prevValue.current;
    }
    prevValue.current = value;
    return value;
  }, [value]);
}
