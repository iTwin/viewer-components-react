/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Id64String } from "@itwin/core-bentley";

/** @internal */
export function createIdsSelector(ids: string[]): string {
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
export function pushToMap<TKey, TValue>(targetMap: Map<TKey, Set<TValue>>, key: TKey, value: TValue) {
  let set = targetMap.get(key);
  if (!set) {
    set = new Set();
    targetMap.set(key, set);
  }
  set.add(value);
}
