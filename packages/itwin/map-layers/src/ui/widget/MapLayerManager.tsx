/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
// cSpell:ignore droppable Sublayer Basemap

import "./MapLayerManager.scss";
import React from "react";
import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { BackgroundMapProvider, BackgroundMapType, BaseMapLayerSettings } from "@itwin/core-common";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority } from "@itwin/core-frontend";
import { ToggleSwitch } from "@itwin/itwinui-react";
import { GoogleMaps } from "@itwin/map-layers-formats";
import { MapLayersUI } from "../../mapLayers";
import { MapLayersSyncUiEventId } from "../../MapLayersActionIds";
import { BasemapPanel } from "./BasemapPanel";
import { useMapLayerSourcesState, useViewportMapLayersState } from "./MapLayerManagerHooks";
import { MapLayersList } from "./MapLayersList";
import { MapLayerSettingsPopupButton } from "./MapLayerSettingsPopupButton";

import type { MapLayerSource, ScreenViewport } from "@itwin/core-frontend";
import type { MapLayerOptions, StyleMapLayerSettings } from "../Interfaces";
import { backgroundMapLayersId, commitMapLayerDrop, getMapLayerDropTargetId, overlayMapLayersId } from "./MapLayerDragDrop";
import type { MapLayerDroppableId } from "./MapLayerDragDrop";
/** @internal */
export interface SourceMapContextProps {
  readonly sources: MapLayerSource[];
  readonly loadingSources: boolean;
  readonly bases: BaseMapLayerSettings[];
  readonly refreshFromStyle: () => void;
  readonly selectAllLayers: (isOverlay: boolean) => void;
  readonly activeViewport?: ScreenViewport;
  readonly backgroundLayers?: StyleMapLayerSettings[];
  readonly overlayLayers?: StyleMapLayerSettings[];
  readonly mapLayerOptions?: MapLayerOptions;
}

/** @internal */
export const defaultBaseMapLayers = [
  BaseMapLayerSettings.fromProvider(BackgroundMapProvider.fromJSON({ name: "BingProvider", type: BackgroundMapType.Aerial })),
  BaseMapLayerSettings.fromProvider(BackgroundMapProvider.fromJSON({ name: "BingProvider", type: BackgroundMapType.Hybrid })),
  BaseMapLayerSettings.fromProvider(BackgroundMapProvider.fromJSON({ name: "BingProvider", type: BackgroundMapType.Street })),
];

/** @internal */
export const SourceMapContext = React.createContext<SourceMapContextProps>({
  sources: [],
  loadingSources: false,
  bases: [],
  refreshFromStyle: () => {},
  selectAllLayers: () => {},
});

/** @internal */
export function useSourceMapContext(): SourceMapContextProps {
  return React.useContext(SourceMapContext);
}

type MapLayerDragState = Record<MapLayerDroppableId, StyleMapLayerSettings[]>;

interface MapLayerManagerProps {
  activeViewport: ScreenViewport;
  mapLayerOptions?: MapLayerOptions;
}

export function MapLayerManager(props: MapLayerManagerProps) {
  const [bgProviders] = React.useState<BaseMapLayerSettings[]>(()=> {
    // Base layers were provided, used it exclusively.
    if (props.mapLayerOptions?.baseMapLayers) {
      return props.mapLayerOptions?.baseMapLayers;
    }

    const bases = [...defaultBaseMapLayers];

    // Add Google Maps layers if the format is registered
    if (IModelApp.mapLayerFormatRegistry.isRegistered("GoogleMaps")) {
      bases.push(GoogleMaps.createBaseLayerSettings({mapType: "satellite", language: "en", region: "US"}));
      bases.push(GoogleMaps.createBaseLayerSettings({mapType: "satellite", layerTypes: ["layerRoadmap"], language: "en", region: "US"}));
      bases.push(GoogleMaps.createBaseLayerSettings({mapType: "roadmap", language: "en", region: "US"}));
    }
    return bases;
  });
  const overlaysLabel = MapLayersUI.localization.getLocalizedString("mapLayers:Widget.OverlayLayers");
  const underlaysLabel = MapLayersUI.localization.getLocalizedString("mapLayers:Widget.BackgroundLayers");
  const { activeViewport, mapLayerOptions } = props;
  const hideExternalMapLayersSection = mapLayerOptions?.hideExternalMapLayers ? mapLayerOptions.hideExternalMapLayers : false;
  const fetchPublicMapLayerSources = mapLayerOptions?.fetchPublicMapLayerSources ? mapLayerOptions.fetchPublicMapLayerSources : false;

  const { loadingSources, mapSources } = useMapLayerSourcesState({
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
  } = useViewportMapLayersState(activeViewport);
  const mapLayersRef = React.useRef(mapLayers);
  const dragStartMapLayersRef = React.useRef<MapLayerDragState>();
  const [dropTargetId, setDropTargetId] = React.useState<MapLayerDroppableId>();
  const [isDraggingMapLayer, setIsDraggingMapLayer] = React.useState(false);
  const backgroundLayers = mapLayers[backgroundMapLayersId];
  const overlayLayers = mapLayers[overlayMapLayersId];

  React.useEffect(() => {
    mapLayersRef.current = mapLayers;
  }, [mapLayers]);

  const handleOnMenuItemSelection = React.useCallback(
    (action: string, mapLayerSettings: StyleMapLayerSettings) => {
      if (!activeViewport || !activeViewport.displayStyle) {
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

      // force UI to update
      loadMapLayerSettingsFromViewport(activeViewport);
    },
    [activeViewport, loadMapLayerSettingsFromViewport],
  );

  const handleLayerVisibilityChange = React.useCallback(
    (mapLayerSettings: StyleMapLayerSettings) => {
      if (activeViewport) {
        const isVisible = !mapLayerSettings.visible;

        const displayStyle = activeViewport.displayStyle;
        const indexInDisplayStyle = displayStyle.findMapLayerIndexByNameAndSource(mapLayerSettings.name, mapLayerSettings.source, mapLayerSettings.isOverlay);
        if (-1 !== indexInDisplayStyle) {
          // update the display style
          displayStyle.changeMapLayerProps({ visible: isVisible }, { index: indexInDisplayStyle, isOverlay: mapLayerSettings.isOverlay });

          // force UI to update
          loadMapLayerSettingsFromViewport(activeViewport);
        }
      }
    },
    [activeViewport, loadMapLayerSettingsFromViewport],
  );

  const handleMapLayersToggle = React.useCallback(() => {
    if (activeViewport) {
      const newState = !backgroundMapVisible;
      activeViewport.viewFlags = activeViewport.viewFlags.with("backgroundMap", newState);
      setBackgroundMapVisible(newState);
      IModelApp.toolAdmin.dispatchUiSyncEvent(MapLayersSyncUiEventId.MapImageryChanged);
    }
  }, [backgroundMapVisible, setBackgroundMapVisible, activeViewport]);

  const handleRefreshFromStyle = React.useCallback(() => {
    if (activeViewport) {
      loadMapLayerSettingsFromViewport(activeViewport);
    }
  }, [activeViewport, loadMapLayerSettingsFromViewport]);

  const restoreDragStartMapLayers = React.useCallback(() => {
    if (!dragStartMapLayersRef.current || mapLayersRef.current === dragStartMapLayersRef.current) {
      return;
    }

    mapLayersRef.current = dragStartMapLayersRef.current;
    setMapLayers(dragStartMapLayersRef.current);
  }, [setMapLayers]);

  const handleMapLayerDragStart = React.useCallback(() => {
    dragStartMapLayersRef.current = mapLayersRef.current;
    setIsDraggingMapLayer(true);
  }, []);

  const handleMapLayerDragOver = React.useCallback(
    (event: Parameters<NonNullable<React.ComponentProps<typeof DragDropProvider>["onDragOver"]>>[0]) => {
      const targetId = getMapLayerDropTargetId(event.operation.target);
      if (!targetId) {
        restoreDragStartMapLayers();
        setDropTargetId(undefined);
        return;
      }

      if (isSameListContainerTarget(event.operation.source?.id, event.operation.target?.id, targetId, mapLayersRef.current)) {
        setDropTargetId(targetId);
        return;
      }

      const nextMapLayers = move(mapLayersRef.current, event) as MapLayerDragState;
      if (hasSameMapLayerOrder(mapLayersRef.current, nextMapLayers)) {
        setDropTargetId(targetId);
        return;
      }

      mapLayersRef.current = nextMapLayers;
      setMapLayers(nextMapLayers);
      setDropTargetId(targetId);
    },
    [restoreDragStartMapLayers, setMapLayers],
  );

  const handleMapLayerDragMove = React.useCallback(
    (event: Parameters<NonNullable<React.ComponentProps<typeof DragDropProvider>["onDragMove"]>>[0]) => {
      const targetId = getMapLayerDropTargetId(event.operation.target);
      if (!targetId) {
        restoreDragStartMapLayers();
      }
      setDropTargetId(targetId);
    },
    [restoreDragStartMapLayers],
  );

  const handleMapLayerDragEnd = React.useCallback(
    (event: Parameters<NonNullable<React.ComponentProps<typeof DragDropProvider>["onDragEnd"]>>[0]) => {
      setIsDraggingMapLayer(false);
      // Suppress the automatic reload triggered by onDisplayStyleChanged so
      // dnd-kit's 250ms drop animation can run without its source element being
      // unmounted/replaced mid-flight (which causes the visible layout shift).
      suppressReloadRef.current = true;
      const committed = commitMapLayerDrop(activeViewport.displayStyle, mapLayersRef.current, event);
      dragStartMapLayersRef.current = undefined;
      if (committed) {
        // Immediately recompute layerIndex values in the ref so that a second
        // drag started before the setTimeout fires uses correct display-style indices.
        mapLayersRef.current = {
          [backgroundMapLayersId]: mapLayersRef.current[backgroundMapLayersId].map((layer, i, arr) => ({
            ...layer,
            layerIndex: arr.length - 1 - i,
          })),
          [overlayMapLayersId]: mapLayersRef.current[overlayMapLayersId].map((layer, i, arr) => ({
            ...layer,
            layerIndex: arr.length - 1 - i,
          })),
        };
        // Wait for the drop animation (~250ms) to finish before reloading.
        // Reloading earlier would change item IDs mid-animation (cross-group
        // moves change the droppableId prefix in the ID), causing a layout shift.
        setTimeout(() => {
          setDropTargetId(undefined);
          suppressReloadRef.current = false;
          loadMapLayerSettingsFromViewport(activeViewport);
        }, 300);
      } else {
        setDropTargetId(undefined);
        suppressReloadRef.current = false;
        // Restore rendered state for cancelled drags, drops outside any droppable,
        // or other cases where commitMapLayerDrop returns false.
        requestAnimationFrame(() => loadMapLayerSettingsFromViewport(activeViewport));
      }
    },
    [activeViewport, loadMapLayerSettingsFromViewport, suppressReloadRef],
  );

  const handleItemSelected = React.useCallback(
    (isOverlay: boolean, _index: number) => {
      if (isOverlay) {
        if (overlayLayers) {
          setMapLayers((prev) => ({ ...prev, [overlayMapLayersId]: [...overlayLayers] }));
        }
      } else {
        if (backgroundLayers) {
          setMapLayers((prev) => ({ ...prev, [backgroundMapLayersId]: [...backgroundLayers] }));
        }
      }
    },
    [backgroundLayers, overlayLayers, setMapLayers],
  );

  const backgroundWasEmptyAtDragStart = isDraggingMapLayer && dragStartMapLayersRef.current?.[backgroundMapLayersId].length === 0;
  const overlayWasEmptyAtDragStart = isDraggingMapLayer && dragStartMapLayersRef.current?.[overlayMapLayersId].length === 0;
  const backgroundBecameEmptyDuringDrag = isDraggingMapLayer
    && !backgroundWasEmptyAtDragStart
    && backgroundLayers.length === 0;
  const overlayBecameEmptyDuringDrag = isDraggingMapLayer
    && !overlayWasEmptyAtDragStart
    && overlayLayers.length === 0;
  const backgroundActionButtonsLayers = backgroundBecameEmptyDuringDrag
    ? dragStartMapLayersRef.current?.[backgroundMapLayersId] ?? backgroundLayers
    : backgroundLayers;
  const overlayActionButtonsLayers = overlayBecameEmptyDuringDrag
    ? dragStartMapLayersRef.current?.[overlayMapLayersId] ?? overlayLayers
    : overlayLayers;
  const showBackgroundEmptyDropPlaceholder = dropTargetId === backgroundMapLayersId && backgroundWasEmptyAtDragStart && backgroundLayers.length === 0;
  const showOverlayEmptyDropPlaceholder = dropTargetId === overlayMapLayersId && overlayWasEmptyAtDragStart && overlayLayers.length === 0;

  const selectAllLayers = React.useCallback(
    (isOverlay: boolean) => {
      const layerList = isOverlay ? [...overlayLayers] : [...backgroundLayers];
      const hasCheckedLayer = undefined !== layerList?.find((value) => value.selected === true);
      layerList.forEach((layer) => {
        layer.selected = !hasCheckedLayer;
      });

      setMapLayers((prev) => ({ ...prev, [isOverlay ? overlayMapLayersId : backgroundMapLayersId]: layerList }));
    },
    [backgroundLayers, overlayLayers, setMapLayers],
  );

  return (
    <SourceMapContext.Provider
      value={{
        activeViewport,
        loadingSources,
        sources: mapSources ?? [],
        bases: bgProviders,
        refreshFromStyle: handleRefreshFromStyle,
        selectAllLayers,
        backgroundLayers,
        overlayLayers,
        mapLayerOptions,
      }}
    >
      {/* Header*/}
      <div className="map-manager-top-header">
        {!props.mapLayerOptions?.hideHeaderLabel &&
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
              {backgroundLayers && overlayLayers && (
                <>
                  <MapLayersList
                    activeViewport={props.activeViewport}
                    actionButtonsLayersList={backgroundActionButtonsLayers}
                    backgroundMapVisible={backgroundMapVisible}
                    dropTargetId={dropTargetId}
                    hideEmptyPlaceholder={backgroundBecameEmptyDuringDrag}
                    isOverlay={false}
                    isDraggingMapLayer={isDraggingMapLayer}
                    label={underlaysLabel}
                    layersList={backgroundLayers}
                    mapLayerOptions={props.mapLayerOptions}
                    onItemEdited={handleRefreshFromStyle}
                    onItemSelected={handleItemSelected}
                    onItemVisibilityToggleClicked={handleLayerVisibilityChange}
                    onMenuItemSelected={handleOnMenuItemSelection}
                    showDropLayerHereWhenEmpty={backgroundWasEmptyAtDragStart}
                    showEmptyDropPlaceholder={showBackgroundEmptyDropPlaceholder}
                  />
                  <MapLayersList
                    activeViewport={props.activeViewport}
                    actionButtonsLayersList={overlayActionButtonsLayers}
                    backgroundMapVisible={backgroundMapVisible}
                    dropTargetId={dropTargetId}
                    hideEmptyPlaceholder={overlayBecameEmptyDuringDrag}
                    isOverlay
                    isDraggingMapLayer={isDraggingMapLayer}
                    label={overlaysLabel}
                    layersList={overlayLayers}
                    mapLayerOptions={props.mapLayerOptions}
                    onItemEdited={handleRefreshFromStyle}
                    onItemSelected={handleItemSelected}
                    onItemVisibilityToggleClicked={handleLayerVisibilityChange}
                    onMenuItemSelected={handleOnMenuItemSelection}
                    showDropLayerHereWhenEmpty={overlayWasEmptyAtDragStart}
                    showEmptyDropPlaceholder={showOverlayEmptyDropPlaceholder}
                  />
                </>
              )}
            </DragDropProvider>
          </div>
        )}
      </div>
    </SourceMapContext.Provider>
  );
}

function hasSameMapLayerOrder(a: MapLayerDragState, b: MapLayerDragState) {
  return hasSameLayerOrder(a[backgroundMapLayersId], b[backgroundMapLayersId])
    && hasSameLayerOrder(a[overlayMapLayersId], b[overlayMapLayersId]);
}

function hasSameLayerOrder(a: StyleMapLayerSettings[], b: StyleMapLayerSettings[]) {
  return a.length === b.length && a.every((layer, index) => layer.id === b[index].id);
}

function isSameListContainerTarget(
  sourceId: unknown,
  targetIdValue: unknown,
  targetId: MapLayerDroppableId,
  mapLayers: MapLayerDragState,
) {
  return targetIdValue === targetId
    && typeof sourceId === "string"
    && mapLayers[targetId].some((layer) => layer.id === sourceId);
}
