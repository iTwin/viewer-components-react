/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useContext, useState } from "react";
import { StatusBarSection } from "@itwin/appui-react";
import { SvgVisibilityShow } from "@itwin/itwinui-icons-react";
import { IconButton } from "@itwin/itwinui-react";

import type { PropsWithChildren } from "react";
import type { UiItemsProvider } from "@itwin/appui-react";

export interface ViewerOptionsContext {
  density: "default" | "enlarged";
}

export interface ViewerActionsContext {
  setDensity: React.Dispatch<React.SetStateAction<"default" | "enlarged">>;
}

const viewerOptionsContext = createContext<ViewerOptionsContext>({} as ViewerOptionsContext);
const viewerActionsContext = createContext<ViewerActionsContext>({} as ViewerActionsContext);

export function ViewerOptionsProvider(props: PropsWithChildren<unknown>) {
  const [density, setDensity] = useState<"default" | "enlarged">("default");

  return (
    <viewerActionsContext.Provider value={{ setDensity }}>
      <viewerOptionsContext.Provider value={{ density }}>{props.children}</viewerOptionsContext.Provider>
    </viewerActionsContext.Provider>
  );
}

export function useViewerOptionsContext() {
  return useContext(viewerOptionsContext);
}

export function useViewerActionsContext() {
  return useContext(viewerActionsContext);
}

export const statusBarActionsProvider: UiItemsProvider = {
  id: "ViewerOptionsUiItemsProvider",
  getStatusBarItems: () => [
    {
      id: `expandedLayoutButton`,
      content: <ToggleLayoutButton />,
      itemPriority: 1,
      section: StatusBarSection.Left,
    },
  ],
};

function ToggleLayoutButton() {
  const { setDensity } = useViewerActionsContext();
  return (
    <IconButton
      // aria-label="Toggle expanded layout"
      label="Toggle expanded layout"
      styleType="borderless"
      onClick={() => setDensity((prev) => (prev === "default" ? "enlarged" : "default"))}
    >
      <SvgVisibilityShow />
    </IconButton>
  );
}
