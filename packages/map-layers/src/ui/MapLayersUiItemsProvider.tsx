/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { UiItemsProvider, Widget } from "@itwin/appui-react";
import { StagePanelLocation, StagePanelSection, StageUsage } from "@itwin/appui-react";
import { MapLayersWidget } from "./widget/MapLayersWidget";
import type { MapLayerOptions } from "./Interfaces";
import { MapLayersUI } from "../mapLayers";

export class MapLayersUiItemsProvider implements UiItemsProvider {
  public readonly id = "MapLayersUiItemsProvider";
  private _mapLayerOptions?: MapLayerOptions;

  public constructor(mapLayerOptions?: MapLayerOptions) {
    this._mapLayerOptions = mapLayerOptions ?? {
      hideExternalMapLayers: false,
      mapTypeOptions: { supportTileUrl: false, supportWmsAuthentication: true },
      fetchPublicMapLayerSources: false,
    };
  }

  public provideWidgets(_stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection) {
    const widgets: Widget[] = [];
    const tmpSection = section ?? StagePanelSection.Start;
    if (stageUsage === StageUsage.General && location === StagePanelLocation.Right && tmpSection === StagePanelSection.Start) {
      widgets.push({
        id: "map-layers:mapLayersWidget",
        label: MapLayersUI.localization.getLocalizedString("mapLayers:Widget.Label"),
        icon: "icon-map",
        content: <MapLayersWidget mapLayerOptions={this._mapLayerOptions} />,
      });
    }
    return widgets;
  }
}
