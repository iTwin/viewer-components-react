/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import React from "react";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority } from "@itwin/core-frontend";
import { MapLayersSyncUiEventId } from "../../../MapLayersActionIds";
import { MapLayersUI } from "../../../mapLayers";

import type { StyleMapLayerSettings } from "../../Interfaces";
import type { MapLayerStyleActions, MapLayerStyleActionsArgs } from "./types";

export function useMapLayerStyleActions(args: MapLayerStyleActionsArgs): MapLayerStyleActions {
  const { activeViewport, backgroundMapVisible, loadMapLayerSettingsFromViewport, setBackgroundMapVisible } = args;

  const handleOnMenuItemSelection = React.useCallback(
    (action: string, mapLayerSettings: StyleMapLayerSettings) => {
      if (!activeViewport.displayStyle) {
        return;
      }

      const indexInDisplayStyle = activeViewport.displayStyle.findMapLayerIndexByNameAndSource(
        mapLayerSettings.name,
        mapLayerSettings.source,
        mapLayerSettings.isOverlay,
      );
      if (indexInDisplayStyle < 0) {
        return;
      }

      switch (action) {
        case "delete":
          activeViewport.displayStyle.detachMapLayerByIndex({ index: indexInDisplayStyle, isOverlay: mapLayerSettings.isOverlay });
          break;
        case "zoom-to-layer":
          activeViewport
            .viewMapLayerRange({ index: indexInDisplayStyle, isOverlay: mapLayerSettings.isOverlay }, activeViewport)
            .then((status) => {
              if (!status) {
                const msg = MapLayersUI.localization.getLocalizedString("mapLayers:Messages.NoRangeDefined");
                IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, `${msg} [${mapLayerSettings.name}]`));
              }
            })
            .catch((_error) => {});
          break;
      }

      loadMapLayerSettingsFromViewport(activeViewport);
    },
    [activeViewport, loadMapLayerSettingsFromViewport],
  );

  const handleLayerVisibilityChange = React.useCallback(
    (mapLayerSettings: StyleMapLayerSettings) => {
      const isVisible = !mapLayerSettings.visible;
      const displayStyle = activeViewport.displayStyle;
      const indexInDisplayStyle = displayStyle.findMapLayerIndexByNameAndSource(mapLayerSettings.name, mapLayerSettings.source, mapLayerSettings.isOverlay);
      if (-1 !== indexInDisplayStyle) {
        displayStyle.changeMapLayerProps({ visible: isVisible }, { index: indexInDisplayStyle, isOverlay: mapLayerSettings.isOverlay });
        loadMapLayerSettingsFromViewport(activeViewport);
      }
    },
    [activeViewport, loadMapLayerSettingsFromViewport],
  );

  const handleMapLayersToggle = React.useCallback(() => {
    const newState = !backgroundMapVisible;
    activeViewport.viewFlags = activeViewport.viewFlags.with("backgroundMap", newState);
    setBackgroundMapVisible(newState);
    IModelApp.toolAdmin.dispatchUiSyncEvent(MapLayersSyncUiEventId.MapImageryChanged);
  }, [activeViewport, backgroundMapVisible, setBackgroundMapVisible]);

  const handleRefreshFromStyle = React.useCallback(() => {
    loadMapLayerSettingsFromViewport(activeViewport);
  }, [activeViewport, loadMapLayerSettingsFromViewport]);

  return {
    handleLayerVisibilityChange,
    handleMapLayersToggle,
    handleOnMenuItemSelection,
    handleRefreshFromStyle,
  };
}
