/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { BeEvent } from "@itwin/core-bentley";

import type { IDisposable } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";

/** @internal */
export interface IVisibilityChangeEventListener extends IDisposable {
  onVisibilityChange: BeEvent<() => void>;
  suppressChangeEvents(): void;
  unSuppressChangeEvents(): void;
}

/** @internal */
export function createVisibilityChangeEventListener(viewport: Viewport): IVisibilityChangeEventListener {
  const onVisibilityChange = new BeEvent<() => void>();
  let pendingVisibilityChange: undefined | ReturnType<typeof setTimeout>;
  let suppressChangeEvents: number = 0;
  const handleVisibilityChange = () => {
    if (pendingVisibilityChange || suppressChangeEvents > 0) {
      return;
    }
    pendingVisibilityChange = setTimeout(() => {
      onVisibilityChange.raiseEvent();
      pendingVisibilityChange = undefined;
    });
  };

  const listeners = [
    viewport.onViewedCategoriesPerModelChanged.addListener(handleVisibilityChange),
    viewport.onViewedCategoriesChanged.addListener(handleVisibilityChange),
    viewport.onViewedModelsChanged.addListener(handleVisibilityChange),
    viewport.onAlwaysDrawnChanged.addListener(handleVisibilityChange),
    viewport.onNeverDrawnChanged.addListener(handleVisibilityChange),
  ];

  return {
    onVisibilityChange,
    dispose: () => {
      // istanbul ignore if
      if (pendingVisibilityChange) {
        clearTimeout(pendingVisibilityChange);
        pendingVisibilityChange = undefined;
      }
      listeners.forEach((x) => x());
      listeners.length = 0;
    },
    suppressChangeEvents: () => {
      suppressChangeEvents++;
    },
    unSuppressChangeEvents: () => {
      suppressChangeEvents--;
      if (suppressChangeEvents === 0) {
        handleVisibilityChange();
      }
    },
  };
}
