/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/** @internal */
export function getUnitName(fullUnitName: string) {
  const nameParts = fullUnitName.split(/[.:]/);
  if (nameParts.length > 0) return nameParts[nameParts.length - 1];
  throw Error("Bad unit name encountered");
}
