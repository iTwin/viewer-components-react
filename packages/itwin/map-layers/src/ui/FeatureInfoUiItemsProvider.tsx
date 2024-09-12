/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { BadgeType, ConditionalBooleanValue } from "@itwin/appui-abstract";
import type { ToolbarItem, UiItemsProvider } from "@itwin/appui-react";
import {
  StagePanelLocation,
  StagePanelSection,
  StageUsage,
  ToolbarHelper,
  ToolbarOrientation,
  ToolbarUsage,
  ToolItemDef,
  WidgetState,
} from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
import type { ScreenViewport } from "@itwin/core-frontend";
import type { MapLayerProps } from "@itwin/core-common";
import { SvgMapInfo } from "@itwin/itwinui-icons-react";
import { MapFeatureInfoTool } from "@itwin/map-layers-formats";

import { MapLayersUI } from "../mapLayers";
import { MapFeatureInfoWidget } from "./widget/FeatureInfoWidget";
import type { MapFeatureInfoOptions } from "./Interfaces";
import { MapLayersSyncUiEventId } from "../MapLayersActionIds";

const supportsMapFeatureInfo = (vp: ScreenViewport, isOverlay: boolean, mapLayerProps: MapLayerProps[]): boolean => {
  for (let mapLayerIndex = 0; mapLayerIndex < mapLayerProps.length; mapLayerIndex++) {
    if (mapLayerProps[mapLayerIndex].visible && mapLayerProps[mapLayerIndex].transparency !== 1.0) {
      const layerProvider = vp.getMapLayerImageryProvider({ index: mapLayerIndex, isOverlay });
      // eslint-disable-next-line @itwin/no-internal
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

export const getMapFeatureInfoToolItemDef = (): ToolItemDef =>
  new ToolItemDef({
    toolId: MapFeatureInfoTool.toolId,
    iconSpec: <SvgMapInfo />,
    label: MapLayersUI.localization.getLocalizedString("mapLayers:FeatureInfoWidget.Label"),
    description: () => MapFeatureInfoTool.description,
    execute: async () => {
      await IModelApp.tools.run(MapFeatureInfoTool.toolId);
    },
    badgeType: BadgeType.TechnicalPreview,
    isHidden: new ConditionalBooleanValue(() => {
      // Hide the MapFeatureInfoTool if the Map Layers toggle is off or no ArcGISFeature layers are active
      return !isMapFeatureInfoSupported();
    }, [MapLayersSyncUiEventId.MapImageryChanged]),
  });

export class FeatureInfoUiItemsProvider implements UiItemsProvider {
  // eslint-disable-line deprecation/deprecation
  public readonly id = "FeatureInfoUiItemsProvider";
  public static readonly widgetId = "map-layers:mapFeatureInfoWidget";

  public constructor(private _featureInfoOpts: MapFeatureInfoOptions) {}

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
      return [ToolbarHelper.createToolbarItemFromItemDef(60, getMapFeatureInfoToolItemDef())];
    }

    return [];
  }

  public provideWidgets(_stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection) {
    const widgets = [];

    const tmpSection = section ?? StagePanelSection.End;
    if (tmpSection === StagePanelSection.End && stageUsage === StageUsage.General && location === StagePanelLocation.Right) {
      widgets.push({
        id: FeatureInfoUiItemsProvider.widgetId,
        label: MapLayersUI.localization.getLocalizedString("mapLayers:FeatureInfoWidget.Label"),
        icon: <SvgMapInfo />,
        content: <MapFeatureInfoWidget featureInfoOpts={this._featureInfoOpts} />,
        defaultState: WidgetState.Hidden,
        badge: BadgeType.TechnicalPreview,
      });
    }

    return widgets;
  }
}
