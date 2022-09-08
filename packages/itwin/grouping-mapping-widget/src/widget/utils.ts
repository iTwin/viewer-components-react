/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
export type CreateTypeFromInterface<Interface> = {
  [Property in keyof Interface]: Interface[Property];
};

export function debounce<F extends (...args: any[]) => void>(
  f: F,
  delay: number,
) {
  let timer: number | undefined;
  return (...args: any[]) => {
    timer && window.clearTimeout(timer);
    timer = window.setTimeout(f, delay, ...args);
  };
}
