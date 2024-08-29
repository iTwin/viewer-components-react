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
  SyncUiEventId,
  ToolbarHelper,
  ToolbarOrientation,
  ToolbarUsage,
  ToolItemDef,
  WidgetState,
} from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
import type { MapLayerImageryProvider, ScreenViewport } from "@itwin/core-frontend";
import { SvgMapInfo } from "@itwin/itwinui-icons-react";
import { MapFeatureInfoTool } from "@itwin/map-layers-formats";

import { MapLayersUI } from "../mapLayers";
import { MapFeatureInfoWidget } from "./widget/FeatureInfoWidget";
import type { MapFeatureInfoOptions } from "./Interfaces";
import { MapLayersSyncUiEventId } from "../MapLayersActionIds";
import type { MapImagerySettings } from "@itwin/core-common";

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
      let isHidden = true;
      if (!FeatureInfoUiItemsProvider.mapLayerProviders) {
        FeatureInfoUiItemsProvider.loadMapLayerProviders();
      }
      FeatureInfoUiItemsProvider.mapLayerProviders?.forEach((provider) => {
        if (provider?.supportsMapFeatureInfo) {
          isHidden = false;
          return;
        }
      });
      return isHidden;
    }, [MapLayersSyncUiEventId.MapImageryChanged, SyncUiEventId.ActiveViewportChanged, SyncUiEventId.ViewStateChanged]),
  });

export class FeatureInfoUiItemsProvider implements UiItemsProvider {
  // eslint-disable-line deprecation/deprecation
  public readonly id = "FeatureInfoUiItemsProvider";
  public static readonly widgetId = "map-layers:mapFeatureInfoWidget";
  private static _mapLayerProviders: MapLayerImageryProvider[] | undefined = undefined;

  public constructor(private _featureInfoOpts: MapFeatureInfoOptions) {
    IModelApp.viewManager.onViewOpen.addOnce((vp: ScreenViewport) => {
      const handleMapImageryChanged = (_args: Readonly<MapImagerySettings>) => {
        FeatureInfoUiItemsProvider.loadMapLayerProviders();
      };
      const handleDisplayStyleChanged = () => {
        FeatureInfoUiItemsProvider.loadMapLayerProviders();
      };
      vp.displayStyle.settings.onMapImageryChanged.addListener(handleMapImageryChanged);
      vp.onDisplayStyleChanged.addListener(handleDisplayStyleChanged);
    });
  }

  /** Gets a list of currently active map layer imagery providers. */
  public static get mapLayerProviders(): MapLayerImageryProvider[] | undefined {
    return this._mapLayerProviders;
  }

  public static loadMapLayerProviders() {
    this._mapLayerProviders = [];
    const vp = IModelApp.viewManager.selectedView;
    if (vp?.viewFlags.backgroundMap) {
      const backgroundLayers = vp.displayStyle.settings.mapImagery.backgroundLayers.map((value) => value.toJSON());
      for (let bgLayerIndex = 0; bgLayerIndex < backgroundLayers.length; bgLayerIndex++) {
        const bgLayerProvider = vp.getMapLayerImageryProvider({ index: bgLayerIndex, isOverlay: false });
        if (!bgLayerProvider) {
          this._mapLayerProviders = undefined;
          return;
        }
        this._mapLayerProviders.push(bgLayerProvider);
      }
      const overlayLayers = vp.displayStyle.settings.mapImagery.overlayLayers.map((value) => value.toJSON());
      for (let ovLayerIndex = 0; ovLayerIndex < overlayLayers.length; ovLayerIndex++) {
        const ovLayerProvider = vp.getMapLayerImageryProvider({ index: ovLayerIndex, isOverlay: true });
        if (!ovLayerProvider) {
          this._mapLayerProviders = undefined;
          return;
        }
        this._mapLayerProviders.push(ovLayerProvider);
      }
    }
  }

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
