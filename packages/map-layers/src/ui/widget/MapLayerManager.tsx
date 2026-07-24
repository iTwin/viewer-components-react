/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
// cSpell:ignore droppable Sublayer Basemap

import "./MapLayerManager.scss";
import React from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { BackgroundMapProvider, BackgroundMapType, BaseMapLayerSettings } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
import { ToggleSwitch } from "@itwin/itwinui-react";
import { GoogleMaps } from "@itwin/map-layers-formats";
import { MapLayersUI } from "../../mapLayers";
import { BasemapPanel } from "./BasemapPanel";
import { MapLayerListProvider } from "../contexts/MapLayerListContext";
import { useMapLayerDrag } from "../hooks/map-layer/useMapLayerDrag";
import { useMapLayerSelectionActions } from "../hooks/map-layer/useMapLayerSelectionActions";
import { useMapLayerSources } from "../hooks/map-layer/useMapLayerSources";
import { useMapLayerStyleActions } from "../hooks/map-layer/useMapLayerStyleActions";
import { useViewportMapLayers } from "../hooks/map-layer/useViewportMapLayers";
import { MapLayersList } from "./MapLayersList";
import { MapLayerSettingsPopupButton } from "./MapLayerSettingsPopupButton";

import type { ScreenViewport } from "@itwin/core-frontend";
import type { MapLayerOptions } from "../Interfaces";
import { backgroundMapLayersId, overlayMapLayersId } from "./MapLayerDragModel";
import { SourceMapContext } from "../contexts/SourceMapContext";

/** @internal */
export const defaultBaseMapLayers = [
  BaseMapLayerSettings.fromProvider(BackgroundMapProvider.fromJSON({ name: "BingProvider", type: BackgroundMapType.Aerial })),
  BaseMapLayerSettings.fromProvider(BackgroundMapProvider.fromJSON({ name: "BingProvider", type: BackgroundMapType.Hybrid })),
  BaseMapLayerSettings.fromProvider(BackgroundMapProvider.fromJSON({ name: "BingProvider", type: BackgroundMapType.Street })),
];

interface MapLayerManagerProps {
  activeViewport: ScreenViewport;
  mapLayerOptions?: MapLayerOptions;
}

export function MapLayerManager(props: MapLayerManagerProps) {
  const { activeViewport, mapLayerOptions } = props;
  const bgProviders = React.useMemo<BaseMapLayerSettings[]>(() => {
    // Base layers were provided, used it exclusively.
    if (mapLayerOptions?.baseMapLayers) {
      return mapLayerOptions.baseMapLayers;
    }

    const bases = [...defaultBaseMapLayers];

    // Add Google Maps layers if the format is registered
    if (IModelApp.mapLayerFormatRegistry.isRegistered("GoogleMaps")) {
      bases.push(GoogleMaps.createBaseLayerSettings({mapType: "satellite", language: "en", region: "US"}));
      bases.push(GoogleMaps.createBaseLayerSettings({mapType: "satellite", layerTypes: ["layerRoadmap"], language: "en", region: "US"}));
      bases.push(GoogleMaps.createBaseLayerSettings({mapType: "roadmap", language: "en", region: "US"}));
    }
    return bases;
  }, [mapLayerOptions?.baseMapLayers]);
  const hideExternalMapLayersSection = mapLayerOptions?.hideExternalMapLayers ?? false;
  const fetchPublicMapLayerSources = mapLayerOptions?.fetchPublicMapLayerSources ?? false;

  const { loadingSources, mapSources } = useMapLayerSources({
    activeViewport,
    fetchPublicMapLayerSources,
    hideExternalMapLayersSection,
  });
  const {
    backgroundMapVisible,
    loadMapLayerSettingsFromViewport,
    setBackgroundMapVisible,
    mapLayers,
    setMapLayers,
    suppressReloadRef,
  } = useViewportMapLayers(activeViewport);
  const backgroundLayers = mapLayers[backgroundMapLayersId];
  const overlayLayers = mapLayers[overlayMapLayersId];
  const {
    handleLayerVisibilityChange,
    handleMapLayersToggle,
    handleOnMenuItemSelection,
    handleRefreshFromStyle,
  } = useMapLayerStyleActions({ activeViewport, backgroundMapVisible, loadMapLayerSettingsFromViewport, setBackgroundMapVisible });
  const { handleItemSelected, selectAllLayers } = useMapLayerSelectionActions({ backgroundLayers, overlayLayers, setMapLayers });
  const {
    dragStartMapLayers,
    dropTargetId,
    handleMapLayerDragEnd,
    handleMapLayerDragMove,
    handleMapLayerDragOver,
    handleMapLayerDragStart,
    isDraggingMapLayer,
  } = useMapLayerDrag({ activeViewport, loadMapLayerSettingsFromViewport, mapLayers, setMapLayers, suppressReloadRef });

  return (
    <SourceMapContext.Provider
      value={{
        activeViewport,
        loadingSources,
        sources: mapSources ?? [],
        bases: bgProviders,
      }}
    >
      {/* Header*/}
      <div className="map-manager-top-header">
        {!mapLayerOptions?.hideHeaderLabel &&
        <span className="map-manager-header-label">{MapLayersUI.localization.getLocalizedString("mapLayers:Basemap.BaseMapPanelTitle")}</span>}
        <div className="map-manager-header-buttons-group">
          <ToggleSwitch className="map-manager-toggle" checked={backgroundMapVisible} onChange={handleMapLayersToggle} />
          <MapLayerSettingsPopupButton disabled={!backgroundMapVisible} />
        </div>
      </div>

      <div className="map-manager-container">
        {/* Base map*/}
        <div className="map-manager-basemap">
          <BasemapPanel disabled={!backgroundMapVisible} />
        </div>

        {/* List of Layers (droppable) */}
        {!hideExternalMapLayersSection && (
          <div>
            <DragDropProvider onDragEnd={handleMapLayerDragEnd} onDragMove={handleMapLayerDragMove} onDragOver={handleMapLayerDragOver} onDragStart={handleMapLayerDragStart}>
              <MapLayerListProvider
                activeViewport={activeViewport}
                backgroundLayers={backgroundLayers}
                disabled={!backgroundMapVisible}
                dropTargetId={dropTargetId}
                isDraggingMapLayer={isDraggingMapLayer}
                mapLayerOptions={mapLayerOptions}
                onItemEdited={handleRefreshFromStyle}
                onItemSelected={handleItemSelected}
                onItemVisibilityToggleClicked={handleLayerVisibilityChange}
                onMenuItemSelected={handleOnMenuItemSelection}
                onSelectAllLayers={selectAllLayers}
                overlayLayers={overlayLayers}
              >
                {backgroundLayers && overlayLayers && (
                  <>
                    <MapLayersList
                      dragStartLayersList={dragStartMapLayers?.[backgroundMapLayersId]}
                      isOverlay={false}
                      layersList={backgroundLayers}
                    />
                    <MapLayersList
                      dragStartLayersList={dragStartMapLayers?.[overlayMapLayersId]}
                      isOverlay
                      layersList={overlayLayers}
                    />
                  </>
                )}
              </MapLayerListProvider>
            </DragDropProvider>
          </div>
        )}
      </div>
    </SourceMapContext.Provider>
  );
}
