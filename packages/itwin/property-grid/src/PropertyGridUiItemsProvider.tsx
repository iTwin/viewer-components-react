/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable react/display-name */

import type { AbstractWidgetProps, UiItemsProvider } from "@itwin/appui-abstract";
import {
  AbstractZoneLocation,
  StagePanelLocation,
  StagePanelSection,
  StageUsage,
  WidgetState,
} from "@itwin/appui-abstract";
import { UiFramework } from "@itwin/appui-react";
import * as React from "react";

import { MultiElementPropertyGrid } from "./components/MultiElementPropertyGrid";
import { PropertyGridManager } from "./PropertyGridManager";
import type { PropertyGridProps } from "./types";

/** Provides the property grid widget to zone 9 */
export class PropertyGridUiItemsProvider implements UiItemsProvider {
  public readonly id = "PropertyGridUiItemsProvider";

  private _props?: PropertyGridProps;

  constructor(props?: PropertyGridProps) {
    this._props = props;
  }

  public provideWidgets(
    _stageId: string,
    stageUsage: string,
    location: StagePanelLocation,
    section?: StagePanelSection | undefined,
    // eslint-disable-next-line deprecation/deprecation
    zoneLocation?: AbstractZoneLocation
  ): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    if (
      (
        stageUsage === StageUsage.General &&
        location === StagePanelLocation.Right &&
        section === StagePanelSection.End &&
        UiFramework.uiVersion !== "1"
      ) ||
      (
        !section &&
        stageUsage === StageUsage.General &&
        // eslint-disable-next-line deprecation/deprecation
        zoneLocation === AbstractZoneLocation.CenterRight
      )
    ) {
      widgets.push({
        id: "vcr:PropertyGrid",
        label: PropertyGridManager.translate("widget-label"),
        getWidgetContent: () => <MultiElementPropertyGrid {...this._props} />,
        defaultState: WidgetState.Closed,
        icon: "icon-info",
      });
    }

    return widgets;
  }
}
