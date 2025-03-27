/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/** @internal */
export function setDifference<T>(lhs: Set<T>, rhs: Set<T>): Set<T> {
  const result = new Set<T>();
  lhs.forEach((x) => !rhs.has(x) && result.add(x));
  return result;
}

/** @internal */
export function setIntersection<T>(lhs: Set<T>, rhs: Set<T>): Set<T> {
  const result = new Set<T>();
  lhs.forEach((x) => rhs.has(x) && result.add(x));
  return result;
}

/** @internal */
export function getDistinctMapValues(map: Map<any, Array<string> | Set<string>>): Set<string> {
  const result = new Set<string>();
  [...map.values()].forEach((values) => {
    values.forEach((value) => result.add(value));
  });
  return result;
}
