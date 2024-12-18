/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useContext, useState } from "react";
import { StatusBarSection } from "@itwin/appui-react";
import { SvgSelection, SvgVisibilityShow } from "@itwin/itwinui-icons-react";
import { IconButton } from "@itwin/itwinui-react";

import type { PropsWithChildren } from "react";
import type { UiItemsProvider } from "@itwin/appui-react";

export interface ViewerOptionsContext {
  density: "default" | "enlarged";
  disableNodesSelection: boolean;
}

export interface ViewerActionsContext {
  setDensity: React.Dispatch<React.SetStateAction<"default" | "enlarged">>;
  setDisableNodesSelection: React.Dispatch<React.SetStateAction<boolean>>;
}

const viewerOptionsContext = createContext<ViewerOptionsContext>({} as ViewerOptionsContext);
const viewerActionsContext = createContext<ViewerActionsContext>({} as ViewerActionsContext);

export function ViewerOptionsProvider(props: PropsWithChildren<unknown>) {
  const [density, setDensity] = useState<"default" | "enlarged">("default");
  const [disableNodesSelection, setDisableNodesSelection] = useState<boolean>(false);
  return (
    <viewerActionsContext.Provider value={{ setDensity, setDisableNodesSelection }}>
      <viewerOptionsContext.Provider value={{ density, disableNodesSelection }}>{props.children}</viewerOptionsContext.Provider>
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
      id: `toggleExpandedLayoutButton`,
      content: <ToggleExpandedLayoutButton />,
      itemPriority: 1,
      section: StatusBarSection.Left,
    },
    {
      id: `toggleTreeNodesSelectionButton`,
      content: <ToggleTreeNodesSelectionButton />,
      itemPriority: 2,
      section: StatusBarSection.Left,
    },
  ],
};

function ToggleExpandedLayoutButton() {
  const { setDensity } = useViewerActionsContext();
  return (
    <IconButton label="Toggle expanded layout" styleType="borderless" onClick={() => setDensity((prev) => (prev === "default" ? "enlarged" : "default"))}>
      <SvgVisibilityShow />
    </IconButton>
  );
}

function ToggleTreeNodesSelectionButton() {
  const { setDisableNodesSelection } = useViewerActionsContext();
  return (
    <IconButton label="Toggle tree nodes' selection" styleType="borderless" onClick={() => setDisableNodesSelection((prev) => !prev)}>
      <SvgSelection />
    </IconButton>
  );
}
