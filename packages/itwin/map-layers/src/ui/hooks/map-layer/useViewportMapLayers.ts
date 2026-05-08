/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import React from "react";
import { ImageMapLayerSettings } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
import { MapLayersSyncUiEventId } from "../../../MapLayersActionIds";

import type { MapImagerySettings, MapSubLayerProps, MapSubLayerSettings } from "@itwin/core-common";
import type { MapLayerImageryProvider, MapLayerScaleRangeVisibility, ScreenViewport, Viewport } from "@itwin/core-frontend";
import type { StyleMapLayerSettings } from "../../Interfaces";
import { backgroundMapLayersId, createMapLayerSortableId, overlayMapLayersId } from "../../widget/MapLayerDragModel";
import type { MapLayerState, ViewportMapLayersState } from "./types";

function getSubLayerProps(subLayerSettings: MapSubLayerSettings[]): MapSubLayerProps[] {
  return subLayerSettings.map((subLayer) => subLayer.toJSON());
}

function getMapLayerSettingsFromViewport(viewport: Viewport, getBackgroundMap: boolean, populateSubLayers = true): StyleMapLayerSettings[] {
  const displayStyle = viewport.displayStyle;
  if (!displayStyle) {
    return [];
  }

  const layers = new Array<StyleMapLayerSettings>();

  const displayStyleLayers = getBackgroundMap ? displayStyle.settings.mapImagery.backgroundLayers : displayStyle.settings.mapImagery.overlayLayers;
  for (let layerIndex = 0; layerIndex < displayStyleLayers.length; layerIndex++) {
    const layerSettings = displayStyleLayers[layerIndex];
    const isOverlay = !getBackgroundMap;
    const layerProvider = viewport.getMapLayerImageryProvider({ index: layerIndex, isOverlay });
    const treeVisibility = viewport.getMapLayerScaleRangeVisibility({ index: layerIndex, isOverlay });
    const popSubLayers = populateSubLayers && layerSettings instanceof ImageMapLayerSettings;
    layers.push({
      id: createMapLayerSortableId(isOverlay ? overlayMapLayersId : backgroundMapLayersId, layerSettings.name),
      visible: layerSettings.visible,
      treeVisibility,
      name: layerSettings.name,
      source: layerSettings.source,
      transparency: layerSettings.transparency,
      transparentBackground: layerSettings.transparentBackground,
      subLayers: popSubLayers ? getSubLayerProps(layerSettings.subLayers) : undefined,
      showSubLayers: false,
      isOverlay,
      layerIndex,
      provider: layerProvider,
      selected: false,
    });
  }

  return layers.reverse();
}

/**
 * Synchronizes map-layer widget state with the active viewport display style.
 *
 * This hook initializes background/overlay layer data from the viewport,
 * subscribes to viewport and display-style events, updates scale visibility
 * and provider status changes, and exposes a guarded reload API used by DnD.
 */
export function useViewportMapLayers(activeViewport: ScreenViewport): ViewportMapLayersState {
  const [mapLayers, setMapLayers] = React.useState<MapLayerState>({
    [backgroundMapLayersId]: getMapLayerSettingsFromViewport(activeViewport, true),
    [overlayMapLayersId]: getMapLayerSettingsFromViewport(activeViewport, false),
  });
  const [backgroundMapVisible, setBackgroundMapVisible] = React.useState(() => activeViewport.viewFlags.backgroundMap);
  const suppressReloadRef = React.useRef(false);

  const loadMapLayerSettingsFromViewport = React.useCallback(
    (viewport: Viewport) => {
      if (suppressReloadRef.current) return;
      setMapLayers({
        [backgroundMapLayersId]: getMapLayerSettingsFromViewport(viewport, true),
        [overlayMapLayersId]: getMapLayerSettingsFromViewport(viewport, false),
      });
    },
    [],
  );

  React.useEffect(() => {
    const updateBackgroundMapVisible = () => setBackgroundMapVisible(activeViewport.viewFlags.backgroundMap);
    return activeViewport.onDisplayStyleChanged.addListener(updateBackgroundMapVisible);
  }, [activeViewport]);

  React.useEffect(() => {
    const handleScaleRangeVisibilityChanged = (layerIndexes: MapLayerScaleRangeVisibility[]) => {
      const updateLayers = (array: StyleMapLayerSettings[] | undefined) => {
        if (array === undefined) {
          return undefined;
        }

        return array.map((curStyledLayer) => {
          const foundScaleRangeVisibility = layerIndexes.find(
            (layerIdx) => layerIdx.index === curStyledLayer.layerIndex && layerIdx.isOverlay === curStyledLayer.isOverlay,
          );
          if (undefined === foundScaleRangeVisibility) {
            return curStyledLayer;
          }

          return { ...curStyledLayer, treeVisibility: foundScaleRangeVisibility.visibility };
        });
      };

      setMapLayers((prev) => {
        const background = updateLayers(prev[backgroundMapLayersId]) ?? [];
        const overlay = updateLayers(prev[overlayMapLayersId]) ?? [];
        return {
          [backgroundMapLayersId]: background,
          [overlayMapLayersId]: overlay,
        };
      });
    };

    return activeViewport.onMapLayerScaleRangeVisibilityChanged.addListener(handleScaleRangeVisibilityChanged);
  }, [activeViewport]);

  React.useEffect(() => {
    const handleMapImageryChanged = (args: Readonly<MapImagerySettings>) => {
      if (
        args.backgroundLayers.length !== mapLayers[backgroundMapLayersId].length ||
        args.overlayLayers.length !== mapLayers[overlayMapLayersId].length
      ) {
        loadMapLayerSettingsFromViewport(activeViewport);
      }
    };

    return activeViewport.displayStyle.settings.onMapImageryChanged.addListener(handleMapImageryChanged);
  }, [activeViewport, mapLayers, loadMapLayerSettingsFromViewport]);

  React.useEffect(() => {
    IModelApp.toolAdmin.dispatchUiSyncEvent(MapLayersSyncUiEventId.MapImageryChanged);
  }, [mapLayers]);

  const handleProviderStatusChanged = React.useCallback(
    (_args: MapLayerImageryProvider) => {
      loadMapLayerSettingsFromViewport(activeViewport);
    },
    [activeViewport, loadMapLayerSettingsFromViewport],
  );

  React.useEffect(() => {
    mapLayers[backgroundMapLayersId].forEach((layer) => {
      layer.provider?.onStatusChanged.addListener(handleProviderStatusChanged);
    });
    mapLayers[overlayMapLayersId].forEach((layer) => {
      layer.provider?.onStatusChanged.addListener(handleProviderStatusChanged);
    });

    return () => {
      mapLayers[backgroundMapLayersId].forEach((layer) => {
        layer.provider?.onStatusChanged.removeListener(handleProviderStatusChanged);
      });
      mapLayers[overlayMapLayersId].forEach((layer) => {
        layer.provider?.onStatusChanged.removeListener(handleProviderStatusChanged);
      });
    };
  }, [mapLayers, handleProviderStatusChanged]);

  React.useEffect(() => {
    setBackgroundMapVisible(activeViewport.viewFlags.backgroundMap);
    loadMapLayerSettingsFromViewport(activeViewport);
  }, [activeViewport, loadMapLayerSettingsFromViewport]);

  React.useEffect(() => {
    const handleDisplayStyleChange = (viewport: Viewport) => {
      loadMapLayerSettingsFromViewport(viewport);
    };

    return activeViewport.onDisplayStyleChanged.addListener(handleDisplayStyleChange);
  }, [activeViewport, loadMapLayerSettingsFromViewport]);

  return {
    backgroundMapVisible,
    loadMapLayerSettingsFromViewport,
    setBackgroundMapVisible,
    mapLayers,
    setMapLayers,
    suppressReloadRef,
  };
}
