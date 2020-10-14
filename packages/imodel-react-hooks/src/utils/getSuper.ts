/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/


/** `getSuper(this)` emulates the `super` keyword, allowing you
 * to access super methods from any context. Takes an optional result type
 * generic parameter if you want typechecking
 */
export const getSuper = <T extends object>(thisObj: T): T =>
  new Proxy(Object.getPrototypeOf(Object.getPrototypeOf(thisObj)), {
    get(obj, k) {
      const val = Reflect.get(obj, k);
      if (typeof val === "function") {
        return val.bind(thisObj);
      } else {
        return val;
      }
    },
  });

export default getSuper;
