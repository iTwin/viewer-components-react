/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { StagePanelLocation, StagePanelSection, StageUsage, ToolbarHelper, ToolbarItem, ToolbarOrientation, ToolbarUsage, ToolItemDef, UiItemsProvider, WidgetState } from "@itwin/appui-react";
import { MapFeatureInfoWidget } from "./widget/FeatureInfoWidget";
import { MapFeatureInfoOptions } from "./Interfaces";
import { MapLayersUI } from "../mapLayers";
import { IModelApp } from "@itwin/core-frontend";
import { MapFeatureInfoTool } from "@itwin/map-layers-formats";
import { SvgMapInfo } from "@itwin/itwinui-icons-react";
import { BadgeType } from "@itwin/appui-abstract";

export const getMapFeatureInfoToolItemDef = (
  showTechPreviewBadge: boolean = false
): ToolItemDef =>
  new ToolItemDef({
    toolId: MapFeatureInfoTool.toolId,
    iconSpec: <SvgMapInfo/>,
    label: MapLayersUI.localization.getLocalizedString("mapLayers:FeatureInfoWidget.Label"),
    description: () => MapFeatureInfoTool.description,
    execute: async () => { await IModelApp.tools.run(MapFeatureInfoTool.toolId); },
    badgeType: showTechPreviewBadge ? BadgeType.TechnicalPreview : BadgeType.None,
  });

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
      return [
        ToolbarHelper.createToolbarItemFromItemDef(60, getMapFeatureInfoToolItemDef(this._featureInfoOpts?.showTechPreviewBadge)),
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
        icon: <SvgMapInfo/>,
        content: <MapFeatureInfoWidget featureInfoOpts={this._featureInfoOpts} />,
        defaultState: WidgetState.Hidden,
        badgeType: this._featureInfoOpts?.showTechPreviewBadge ? BadgeType.TechnicalPreview : BadgeType.None,
      });
    }

    return widgets;
  }
}
