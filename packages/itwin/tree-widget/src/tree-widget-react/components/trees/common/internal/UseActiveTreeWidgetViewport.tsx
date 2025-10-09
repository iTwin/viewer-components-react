/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useState } from "react";
import { useActiveViewport } from "@itwin/appui-react";
import { createTreeWidgetViewport } from "../TreeWidgetViewport.js";

import type { Viewport } from "@itwin/core-frontend";
import type { TreeWidgetViewport } from "../TreeWidgetViewport.js";

/** @internal */
export function useActiveTreeWidgetViewport({ treeWidgetViewport }: { treeWidgetViewport?: TreeWidgetViewport }): TreeWidgetViewport | undefined {
  const viewport = useActiveViewport();
  const [activeViewport, setActiveViewport] = useState(treeWidgetViewport ?? createTreeWidgetViewportInternal(viewport));
  useEffect(() => {
    if (treeWidgetViewport) {
      setActiveViewport(treeWidgetViewport);
      return;
    }
    setActiveViewport(createTreeWidgetViewportInternal(viewport));
  }, [treeWidgetViewport, viewport]);

  return activeViewport;
}

function createTreeWidgetViewportInternal(viewport: Viewport | undefined): TreeWidgetViewport | undefined {
  return viewport ? createTreeWidgetViewport(viewport) : undefined;
}
