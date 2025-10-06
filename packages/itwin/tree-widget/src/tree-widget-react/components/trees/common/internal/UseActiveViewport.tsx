/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useState } from "react";
import { IModelApp } from "@itwin/core-frontend";
import { createTreeWidgetViewport } from "../TreeWidgetViewport.js";

import type { ScreenViewport } from "@itwin/core-frontend";
import type { TreeWidgetViewport } from "../TreeWidgetViewport.js";

/**
 * A copy of `useActiveViewport` from `@itwin/appui-react` package until X is fixed.
 * @internal
 */
export function useActiveViewport({ treeWidgetViewport }: { treeWidgetViewport?: TreeWidgetViewport }): TreeWidgetViewport | undefined {
  const [activeViewport, setActiveViewport] = useState(treeWidgetViewport ?? createTreeWidgetViewportInternal(IModelApp.viewManager.selectedView));
  useEffect(() => {
    if (treeWidgetViewport) {
      setActiveViewport(treeWidgetViewport);
      return;
    } else {
      setActiveViewport(createTreeWidgetViewportInternal(IModelApp.viewManager.selectedView));
      return IModelApp.viewManager.onSelectedViewportChanged.addListener((args) => {
        setActiveViewport(createTreeWidgetViewportInternal(args.current));
      });
    }
  }, [treeWidgetViewport]);

  return activeViewport;
}

function createTreeWidgetViewportInternal(viewport: ScreenViewport | undefined): TreeWidgetViewport | undefined {
  return viewport ? createTreeWidgetViewport(viewport) : undefined;
}
