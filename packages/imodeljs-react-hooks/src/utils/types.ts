// Copyright (c) Bentley Systems, Incorporated. All rights reserved.

/** `Rebind<Type, NewThis>` returns the same Type with all implicit `this` parameters
 * rebound to the `NewThis` type. Useful when we map functions defined in an object onto
 * some class instance with a different this type.
 */
export type Rebind<Type extends object, NewThis> = {
  [K in keyof Type]: Type[K] extends (...p: infer P) => infer R
    ? (this: NewThis, ...p: P) => R
    : Type[K];
};
