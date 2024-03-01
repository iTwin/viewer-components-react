/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { StatusBarItem, StatusBarSection, UiItemsProvider } from "@itwin/appui-react";
import { SvgVisibilityShow } from "@itwin/itwinui-icons-react";
import { createContext, PropsWithChildren, useContext, useState } from "react";

export interface ViewerOptionsContext {
  density: "default" | "enlarged";
  setDensity: React.Dispatch<React.SetStateAction<"default" | "enlarged">>;
}

const viewerOptionsContext = createContext<ViewerOptionsContext>({} as ViewerOptionsContext);

export function ViewerOptionsProvider(props: PropsWithChildren<unknown>) {
  const [density, setDensity] = useState<"default" | "enlarged">("default");

  return <viewerOptionsContext.Provider value={{ density, setDensity }}>{props.children}</viewerOptionsContext.Provider>;
}

export function useViewerOptionsContext() {
  return useContext(viewerOptionsContext);
}

export class ViewerOptionsUiItemsProvider implements UiItemsProvider {
  public readonly id = "ViewerOptionsUiItemsProvider";
  private readonly setDensity: React.Dispatch<React.SetStateAction<"default" | "enlarged">>;
  private isEnlarged = false;

  constructor(setDensity: React.Dispatch<React.SetStateAction<"default" | "enlarged">>) {
    this.setDensity = setDensity;
  }

  public getStatusBarItems(): ReadonlyArray<StatusBarItem> {
    return [
      {
        id: `${this.id}:expandedLayoutButton`,
        tooltip: "Toggle expanded layout",
        icon: (<SvgVisibilityShow />),
        label: "expandedLayoutToggle",
        section: StatusBarSection.Left,
        itemPriority: 1,
        execute: () => {
          this.isEnlarged = !this.isEnlarged;
          this.setDensity(this.isEnlarged ? "enlarged" : "default");
        },
      },
    ];
  }
}
