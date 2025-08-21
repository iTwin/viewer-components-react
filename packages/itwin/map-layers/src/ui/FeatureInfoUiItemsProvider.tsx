/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { ConditionalBooleanValue } from "@itwin/appui-abstract";
import { StagePanelLocation, StagePanelSection, StageUsage, ToolbarItemUtilities, ToolbarOrientation, ToolbarUsage, WidgetState } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
import { SvgMapInfo } from "@itwin/itwinui-icons-react";
import { MapFeatureInfoTool } from "@itwin/map-layers-formats";
import { MapLayersUI } from "../mapLayers";
import { MapLayersSyncUiEventId } from "../MapLayersActionIds";
import { MapFeatureInfoWidget } from "./widget/FeatureInfoWidget";

import type { ToolbarActionItem, ToolbarItem, UiItemsProvider } from "@itwin/appui-react";
import type { ScreenViewport } from "@itwin/core-frontend";
import type { MapLayerProps } from "@itwin/core-common";
import type { MapFeatureInfoOptions } from "./Interfaces";
const supportsMapFeatureInfo = (vp: ScreenViewport, isOverlay: boolean, mapLayerProps: MapLayerProps[]): boolean => {
  for (let mapLayerIndex = 0; mapLayerIndex < mapLayerProps.length; mapLayerIndex++) {
    if (mapLayerProps[mapLayerIndex].visible && mapLayerProps[mapLayerIndex].transparency !== 1.0) {
      const layerProvider = vp.getMapLayerImageryProvider({ index: mapLayerIndex, isOverlay });
      if (layerProvider?.supportsMapFeatureInfo) {
        return true;
      }
    }
  }
  return false;
};

const isMapFeatureInfoSupported = (): boolean => {
  const vp = IModelApp.viewManager.selectedView;
  if (vp?.viewFlags.backgroundMap) {
    const backgroundLayers = vp.displayStyle.settings.mapImagery.backgroundLayers.map((value) => value.toJSON());
    if (supportsMapFeatureInfo(vp, false, backgroundLayers)) {
      return true;
    }
    const overlayLayers = vp.displayStyle.settings.mapImagery.overlayLayers.map((value) => value.toJSON());
    if (supportsMapFeatureInfo(vp, true, overlayLayers)) {
      return true;
    }
  }
  return false;
};

export const getMapFeatureInfoToolItemDef = (itemPriority: number): ToolbarActionItem => {
  return ToolbarItemUtilities.createActionItem({
    id: MapFeatureInfoTool.toolId,
    icon: <SvgMapInfo />, // TODO: Update to iconNode when moving to 5.x appui-react
    label: MapLayersUI.localization.getLocalizedString("mapLayers:FeatureInfoWidget.Label"),
    description: MapFeatureInfoTool.description,
    itemPriority,
    execute: async () => {
      await IModelApp.tools.run(MapFeatureInfoTool.toolId);
    },
    isHidden: new ConditionalBooleanValue(() => {
      // Hide the MapFeatureInfoTool if the Map Layers toggle is off or no ArcGISFeature layers are active
      return !isMapFeatureInfoSupported();
    }, [MapLayersSyncUiEventId.MapImageryChanged]),
    layouts: {
      standard: {
        orientation: ToolbarOrientation.Vertical,
        usage: ToolbarUsage.ContentManipulation,
      }
    }
  });
};

export class FeatureInfoUiItemsProvider implements UiItemsProvider {
  public readonly id = "FeatureInfoUiItemsProvider";
  public static readonly widgetId = "map-layers:mapFeatureInfoWidget";

  public constructor(private _featureInfoOpts: MapFeatureInfoOptions) {}

  public getToolbarItems(): ReadonlyArray<ToolbarItem> {
    if (!this._featureInfoOpts?.disableDefaultFeatureInfoTool) {
      return [getMapFeatureInfoToolItemDef(60)];
    }

    return [];
  }

  public provideWidgets(_stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection) {
    const widgets = [];

    const tmpSection = section ?? StagePanelSection.End;
    if (tmpSection === StagePanelSection.End && (stageUsage === StageUsage.General || stageUsage === StageUsage.Edit) && location === StagePanelLocation.Right) {
      widgets.push({
        id: FeatureInfoUiItemsProvider.widgetId,
        label: MapLayersUI.localization.getLocalizedString("mapLayers:FeatureInfoWidget.Label"),
        icon: <SvgMapInfo />,
        content: <MapFeatureInfoWidget featureInfoOpts={this._featureInfoOpts} />,
        defaultState: WidgetState.Hidden,
      });
    }

    return widgets;
  }
}
