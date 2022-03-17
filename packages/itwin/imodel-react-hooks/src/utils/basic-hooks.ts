/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useEffect, useMemo, useRef } from "react";

/** perform code on mount, executing in render order, which
 * effects cannot do.
 */
export function useOnMountInRenderOrder(effect: () => void | (() => void)) {
  const mounted = useRef(false);
  const cleanup = useRef<() => void>();

  if (!mounted.current) {
    mounted.current = true;
    const cleanupFunc = effect();
    if (cleanupFunc) {
      cleanup.current = cleanupFunc;
    }
  }

  useEffect(() => () => cleanup.current?.(), []);
}

/** run code on component mount */
export function useOnMount(impl: () => void) {
  useEffect(() => void impl(), []);
}

/** run something on component unmount */
export function useOnUnmount(impl: () => void) {
  useEffect(() => () => impl(), []);
}

/** create a stable object reference on intialization */
export function useStable<T>(make: () => T) {
  const valueRef = useRef<T>(undefined as any);
  const hasMade = useRef(false);
  if (!hasMade.current) {
    valueRef.current = make();
    hasMade.current = true;
  }
  return valueRef.current;
}

/**
 * throws an error if the pass object changes its key shape between renders:
 *
 * @example
 * render1:
 *   useErrorOnUnstableShape({a: 1, b: 1});
 * render2:
 *   useErrorOnUnstableShape({a: {d: "world"}, b: "hello"});
 *   // no error thrown
 *
 * render1:
 *   useErrorOnUnstableShape({a: 1, b: 1});
 * render2:
 *   useErrorOnUnstableShape({a: 1});
 *   // error thrown (key removed)
 *
 * render1:
 *   useErrorOnUnstableShape({a: 1, b: 1});
 * render2:
 *   useErrorOnUnstableShape({a: 1, b: 1, c: 2});
 *   // error thrown (key added)
 */
export function useErrorOnUnstableShape<T extends {}>(
  object: T,
  consumerName = "useErrorOnUnstableShape"
): void {
  const originalKeys = useStable(() => Object.keys(object));
  const currentKeys = Object.keys(object);

  if (
    !(
      originalKeys.length === currentKeys.length &&
      originalKeys.every((_key, i) => originalKeys[i] === currentKeys[i])
    )
  ) {
    throw Error(
      `"${consumerName}" must always receive the same object shape/scheme each time ` +
        "(i.e. same property set in same order, so no conditional/dynamic properties)"
    );
  }
}
