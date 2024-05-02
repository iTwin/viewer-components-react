/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { BeEvent } from "@itwin/core-bentley";

import type { IDisposable } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { VisibilityChangeListener } from "../../VisibilityTreeEventHandler";

/** @internal */
export interface IVisibilityChangeEventListener extends IDisposable {
  onVisibilityChange: BeEvent<VisibilityChangeListener>;
}

/** @internal */
export function createVisibilityChangeEventListener(viewport: Viewport): IVisibilityChangeEventListener {
  const onVisibilityChange = new BeEvent<() => void>();
  let pendingVisibilityChange: undefined | ReturnType<typeof setTimeout>;
  const handleVisibilityChange = () => {
    if (pendingVisibilityChange) {
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
  };
}
