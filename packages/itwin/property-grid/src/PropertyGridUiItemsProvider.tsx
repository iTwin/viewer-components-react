/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import React from "react";
import { StagePanelLocation, StagePanelSection, StageUsage, UiItemsProvider, Widget, WidgetState } from "@itwin/appui-react";
import { MultiElementPropertyGrid, MultiElementPropertyGridId } from "./components/MultiElementPropertyGrid";
import { PropertyGridManager } from "./PropertyGridManager";

import type { PropertyGridProps } from "./types";

/** Provides the property grid widget to zone 9 */
export class PropertyGridUiItemsProvider implements UiItemsProvider {
  public readonly id = "PropertyGridUiItemsProvider";
  public static readonly providerId = "PropertyGridUiItemsProvider";
  private _props?: PropertyGridProps;

  constructor(props?: PropertyGridProps) {
    this._props = props;
  }

  public provideWidgets(_stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection): ReadonlyArray<Widget> {
    const widgets: Widget[] = [];
    const preferredLocation = this._props?.defaultPanelLocation ?? StagePanelLocation.Right;
    const preferredPanelSection = this._props?.defaultPanelSection ?? StagePanelSection.End;
    if (stageUsage === StageUsage.General && location === preferredLocation && section === preferredPanelSection) {
      widgets.push({
        id: MultiElementPropertyGridId,
        label: PropertyGridManager.translate("widget-label"),
        content: <MultiElementPropertyGrid {...this._props} />,
        defaultState: WidgetState.Hidden,
        icon: "icon-info",
        priority: this._props?.defaultPanelWidgetPriority,
      });
    }

    return widgets;
  }
}
