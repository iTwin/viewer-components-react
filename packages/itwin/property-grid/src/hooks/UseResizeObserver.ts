/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useRef, useState } from "react";
import { assert } from "@itwin/core-bentley";

/**
 * @internal
 */
export function useResizeObserver<T extends HTMLElement>() {
  const observer = useRef<ResizeObserver>();
  const [{ width, height }, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const ref = useCallback((element: T | null) => {
    observer.current?.disconnect();
    if (element) {
      observer.current = new ResizeObserver(
        /* istanbul ignore next */
        (entries) => {
          window.requestAnimationFrame(() => {
            assert(entries.length === 1);
            setSize(entries[0].contentRect);
          });
        },
      );
      observer.current.observe(element);
    }
  }, []);

  return {
    ref,
    width,
    height,
  };
}
