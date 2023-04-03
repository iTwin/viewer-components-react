/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** Checks if the specified argument is a promise */
export function isPromiseLike(obj: unknown): obj is PromiseLike<unknown> {
  return !!(obj && (typeof obj === "object") && (typeof (obj as any).then === "function"));
}
