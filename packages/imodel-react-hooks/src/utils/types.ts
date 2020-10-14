/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/


/** typescript type utilities */

// TODO: this can probably just be replaced with typescript's ThisType but it may require a tsconfig change on consumers so maybe not?
/** `Rebind<Type, NewThis>` returns the same Type with all implicit `this` parameters
 * rebound to the `NewThis` type. Useful when we map functions defined in an object onto
 * some class instance with a different this type.
 */
export type Rebind<Type extends object, NewThis> = {
  [K in keyof Type]: Type[K] extends (...p: infer P) => infer R
    ? (this: NewThis, ...p: P) => R
    : Type[K];
};

/** @internal */
export type ExtendedImplementation<
  Type extends new (...a: any[]) => any
> = Partial<InstanceType<Type>> & {
  [k: string]: any;
};
