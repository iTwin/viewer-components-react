/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";

// This file is inherited from the itwinui-useResizeObserver.tsx
// https://github.com/iTwin/iTwinUI/blob/87bbc99316c17bd2b763a730135fbb45c84b0e82/packages/itwinui-react/src/utils/hooks/useResizeObserver.tsx

const getWindow = () => {
  return typeof window === "undefined" ? undefined : window;
};

export const useResizeObserver = <T extends HTMLElement>(
  onResize: (size: DOMRectReadOnly) => void,
) => {
  const resizeObserver = React.useRef<ResizeObserver>();

  const elementRef = React.useCallback(
    (element: T | null | undefined) => {
      if (!getWindow()?.ResizeObserver) {
        return;
      }

      resizeObserver.current?.disconnect?.();
      if (element) {
        resizeObserver.current = new ResizeObserver((entries) => {
          // We wrap onResize with requestAnimationFrame to avoid this error - ResizeObserver loop limit exceeded
          // See: https://github.com/iTwin/iTwinUI/issues/1317
          // See: https://stackoverflow.com/a/58701523/11547064
          window.requestAnimationFrame(() => {
            if (!Array.isArray(entries) || !entries.length) {
              return;
            }

            const [{ contentRect }] = entries;
            return onResize(contentRect);
          });
        });
        resizeObserver.current?.observe?.(element);
      }
    },
    [onResize],
  );

  return [elementRef, resizeObserver.current] as const;
};
