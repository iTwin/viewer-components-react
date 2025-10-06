/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { BeEvent } from "@itwin/core-bentley";

import type { TreeWidgetViewport } from "../TreeWidgetViewport.js";

/** @internal */
export interface IVisibilityChangeEventListener extends Disposable {
  onVisibilityChange: BeEvent<() => void>;
  suppressChangeEvents(): void;
  resumeChangeEvents(): void;
}

/** @internal */
export function createVisibilityChangeEventListener(props: {
  viewport: TreeWidgetViewport;
  listeners: {
    elements?: boolean;
    categories?: boolean;
    displayStyle?: boolean;
    models?: boolean;
  };
}): IVisibilityChangeEventListener {
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

  const listeners = new Array<() => void>();

  if (props.listeners.elements) {
    listeners.push(props.viewport.onAlwaysDrawnChanged.addListener(handleVisibilityChange));
    listeners.push(props.viewport.onNeverDrawnChanged.addListener(handleVisibilityChange));
  }
  if (props.listeners.categories) {
    listeners.push(props.viewport.onPerModelCategoriesOverridesChanged.addListener(handleVisibilityChange));
    listeners.push(props.viewport.onDisplayedCategoriesChanged.addListener(handleVisibilityChange));
  }
  if (props.listeners.displayStyle) {
    listeners.push(props.viewport.onDisplayStyleChanged.addListener(handleVisibilityChange));
  }
  if (props.listeners.models) {
    listeners.push(props.viewport.onDisplayedModelsChanged.addListener(handleVisibilityChange));
  }

  return {
    onVisibilityChange,
    [Symbol.dispose]() {
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
    resumeChangeEvents: () => {
      suppressChangeEvents--;
      if (suppressChangeEvents === 0) {
        handleVisibilityChange();
      }
    },
  };
}
