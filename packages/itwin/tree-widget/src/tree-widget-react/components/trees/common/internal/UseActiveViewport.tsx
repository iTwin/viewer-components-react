/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useState } from "react";
import { IModelApp } from "@itwin/core-frontend";
import { createTreeWidgetViewport } from "../TreeWidgetViewport.js";

import type { ScreenViewport, Viewport } from "@itwin/core-frontend";
import type { TreeWidgetViewport } from "../TreeWidgetViewport.js";

/**
 * A copy of `useActiveViewport` from `@itwin/appui-react` package until X is fixed.
 * @internal
 */
export function useActiveViewport({ viewport }: { viewport?: Viewport | TreeWidgetViewport }): TreeWidgetViewport | undefined {
  const [activeViewport, setActiveViewport] = useState(createTreeWidgetViewportInternal(viewport ?? IModelApp.viewManager.selectedView));
  useEffect(() => {
    if (viewport) {
      setActiveViewport(createTreeWidgetViewportInternal(viewport));
      return;
    }
    setActiveViewport(createTreeWidgetViewportInternal(IModelApp.viewManager.selectedView));
    return IModelApp.viewManager.onSelectedViewportChanged.addListener((args) => {
      setActiveViewport(createTreeWidgetViewportInternal(args.current));
    });
  }, [viewport]);

  return activeViewport;
}

function createTreeWidgetViewportInternal(viewport: TreeWidgetViewport | Viewport | undefined): TreeWidgetViewport | undefined {
  return viewport ? createTreeWidgetViewport(viewport) : undefined;
}
