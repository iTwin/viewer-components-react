/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, PropsWithChildren, useContext, useState } from "react";
import { StatusBarItem, StatusBarSection, UiItemsProvider } from "@itwin/appui-react";
import { SvgVisibilityShow } from "@itwin/itwinui-icons-react";

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

export class ViewerOptionsUiItemsProvider implements UiItemsProvider {
  public readonly id = "ViewerOptionsUiItemsProvider";
  private readonly setDensity: React.Dispatch<React.SetStateAction<"default" | "enlarged">>;

  constructor(setDensity: React.Dispatch<React.SetStateAction<"default" | "enlarged">>) {
    this.setDensity = setDensity;
  }

  public getStatusBarItems(): ReadonlyArray<StatusBarItem> {
    return [
      {
        id: `${this.id}:expandedLayoutButton`,
        tooltip: "Toggle expanded layout",
        icon: <SvgVisibilityShow />,
        label: "expandedLayoutToggle",
        section: StatusBarSection.Left,
        itemPriority: 1,
        execute: () => this.setDensity((prev) => (prev === "default" ? "enlarged" : "default")),
      },
    ];
  }
}
