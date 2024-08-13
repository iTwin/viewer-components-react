/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useState } from "react";
import type { ScreenViewport } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";

/** 
 * A copy of `useActiveViewport` from `@itwin/appui-react` package until X is fixed.
 * @internal
 */
export function useActiveViewport(): ScreenViewport | undefined {
  const [activeViewport, setActiveViewport] = useState(
    IModelApp.viewManager.selectedView
  );
  useEffect(() => {
    setActiveViewport(IModelApp.viewManager.selectedView);
    return IModelApp.viewManager.onSelectedViewportChanged.addListener(
      (args) => {
        setActiveViewport(args.current);
      }
    );
  }, []);

  return activeViewport;
}
