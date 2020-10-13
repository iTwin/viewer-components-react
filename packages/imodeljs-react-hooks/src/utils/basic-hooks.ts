// Copyright (c) Bentley Systems, Incorporated. All rights reserved.
import { useEffect, useRef } from "react";

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
