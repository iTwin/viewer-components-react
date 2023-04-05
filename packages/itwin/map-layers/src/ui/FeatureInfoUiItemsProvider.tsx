/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { StagePanelLocation, StagePanelSection, StageUsage, ToolbarHelper, ToolbarItem, ToolbarOrientation, ToolbarUsage, UiItemsProvider, WidgetState } from "@itwin/appui-react";
import { MapFeatureInfoWidget } from "./widget/FeatureInfoWidget";
import { MapFeatureInfoOptions } from "./Interfaces";
import { MapLayersUI } from "../mapLayers";
import { DefaultMapFeatureInfoTool, getDefaultMapFeatureInfoToolItemDef } from "./MapFeatureInfoTool";

export class FeatureInfoUiItemsProvider implements UiItemsProvider { // eslint-disable-line deprecation/deprecation
  public readonly id = "FeatureInfoUiItemsProvider";
  public static readonly widgetId = "map-layers:mapFeatureInfoWidget";

  public constructor(private _featureInfoOpts: MapFeatureInfoOptions) { }

  public provideToolbarItems(
    _stageId: string,
    stageUsage: string,
    toolbarUsage: ToolbarUsage,
    toolbarOrientation: ToolbarOrientation,
  ): ReadonlyArray<ToolbarItem> {
    if (
      !this._featureInfoOpts?.disableDefaultFeatureInfoTool &&
      stageUsage === StageUsage.General &&
      toolbarUsage === ToolbarUsage.ContentManipulation &&
      toolbarOrientation === ToolbarOrientation.Vertical
    ) {
      DefaultMapFeatureInfoTool.register(MapLayersUI.localizationNamespace);
      return [
        ToolbarHelper.createToolbarItemFromItemDef(60, getDefaultMapFeatureInfoToolItemDef()),
      ];
    }

    return [];
  }

  public provideWidgets(_stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection) {
    const widgets = [];

    const tmpSection = section ?? StagePanelSection.End;
    if (tmpSection === StagePanelSection.End  && stageUsage === StageUsage.General && location === StagePanelLocation.Right )  {
      widgets.push({
        id: FeatureInfoUiItemsProvider.widgetId,
        label: MapLayersUI.localization.getLocalizedString("mapLayers:FeatureInfoWidget.Label"),
        icon: "icon-map",
        content: <MapFeatureInfoWidget featureInfoOpts={this._featureInfoOpts} />,
        defaultState: WidgetState.Closed,
      });
    }

    return widgets;
  }
}
