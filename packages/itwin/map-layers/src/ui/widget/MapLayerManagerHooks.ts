/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import React from "react";
import { BentleyError, compareStrings } from "@itwin/core-bentley";
import { ImageMapLayerSettings } from "@itwin/core-common";
import { IModelApp, MapLayerSources, NotifyMessageDetails, OutputMessagePriority } from "@itwin/core-frontend";
import { CustomParamsMappingStorage } from "../../CustomParamsMappingStorage";
import { CustomParamUtils } from "../../CustomParamUtils";
import { MapLayerPreferences, MapLayerSourceChangeType } from "../../MapLayerPreferences";
import { MapLayersSyncUiEventId } from "../../MapLayersActionIds";

import type { MapImagerySettings, MapSubLayerProps, MapSubLayerSettings } from "@itwin/core-common";
import type { MapLayerImageryProvider, MapLayerScaleRangeVisibility, MapLayerSource, ScreenViewport, Viewport } from "@itwin/core-frontend";
import type { StyleMapLayerSettings } from "../Interfaces";
import type { MapLayerDroppableId } from "./MapLayerDragDrop";
import { backgroundMapLayersId, createMapLayerSortableId, overlayMapLayersId } from "./MapLayerDragDrop";

interface ViewportMapLayersState {
  backgroundMapVisible: boolean;
  setBackgroundMapVisible: React.Dispatch<React.SetStateAction<boolean>>;
  loadMapLayerSettingsFromViewport: (viewport: Viewport) => void;
  mapLayers: MapLayerState;
  setMapLayers: React.Dispatch<React.SetStateAction<MapLayerState>>;
  suppressReloadRef: React.MutableRefObject<boolean>;
}

type MapLayerState = Record<MapLayerDroppableId, StyleMapLayerSettings[]>;

interface MapLayerSourcesState {
  loadingSources: boolean;
  mapSources: MapLayerSource[] | undefined;
}

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

  // since we want to display higher level maps above lower maps in UI reverse their order here.
  return layers.reverse();
}

function useIsMountedRef() {
  const isMounted = React.useRef(false);

  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return isMounted;
}

/** @internal */
export function useViewportMapLayersState(activeViewport: ScreenViewport): ViewportMapLayersState {
  const [mapLayers, setMapLayers] = React.useState<MapLayerState>({
    [backgroundMapLayersId]: getMapLayerSettingsFromViewport(activeViewport, true),
    [overlayMapLayersId]: getMapLayerSettingsFromViewport(activeViewport, false),
  });
  const [backgroundMapVisible, setBackgroundMapVisible] = React.useState(() => activeViewport.viewFlags.backgroundMap);

  // When true, loadMapLayerSettingsFromViewport is a no-op.  Used to suppress
  // the automatic reload triggered by onDisplayStyleChanged while dnd-kit's
  // drop animation is running, so the animation is not interrupted mid-flight.
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

/** @internal */
export function useMapLayerSourcesState(args: {
  activeViewport: ScreenViewport;
  fetchPublicMapLayerSources: boolean;
  hideExternalMapLayersSection: boolean;
}): MapLayerSourcesState {
  const { activeViewport, fetchPublicMapLayerSources, hideExternalMapLayersSection } = args;
  const [mapSources, setMapSources] = React.useState<MapLayerSource[] | undefined>();
  const [loadingSources, setLoadingSources] = React.useState(false);
  const isMounted = useIsMountedRef();

  React.useEffect(() => {
    async function fetchSources() {
      let preferenceSources: MapLayerSource[] = [];
      const sourceLayers = await MapLayerSources.create(undefined, fetchPublicMapLayerSources && !hideExternalMapLayersSection);

      const iModel = activeViewport.iModel;
      try {
        if (iModel?.iTwinId !== undefined) {
          preferenceSources = await MapLayerPreferences.getSources(iModel.iTwinId, iModel.iModelId);
        }
      } catch (err) {
        IModelApp.notifications.outputMessage(
          new NotifyMessageDetails(
            OutputMessagePriority.Error,
            IModelApp.localization.getLocalizedString("mapLayers:CustomAttach.ErrorLoadingLayers"),
            BentleyError.getErrorMessage(err),
          ),
        );
      }

      if (!isMounted.current) {
        return;
      }

      const sources: MapLayerSource[] = [];
      const addSource = (source: MapLayerSource) => !source.baseMap && sources.push(source);
      sourceLayers?.allSource.forEach(addSource);
      const cpMappingStorage = new CustomParamsMappingStorage();
      preferenceSources.forEach((source) => {
        if (!sources.find((curSource) => source.name === curSource.name)) {
          const cpMapping = cpMappingStorage.get(source.url.toLowerCase());
          if (cpMapping && !Array.isArray(cpMapping)) {
            CustomParamUtils.setSourceCustomParams(source, cpMapping.customParamNames);
          }
          addSource(source);
        }
      });
      sources.sort((a: MapLayerSource, b: MapLayerSource) => compareStrings(a.name.toLowerCase(), b.name.toLowerCase()));

      setMapSources(sources);
    }

    setLoadingSources(true);

    fetchSources()
      .then(() => {
        if (isMounted.current) {
          setLoadingSources(false);
        }
      })
      .catch(() => {
        if (isMounted.current) {
          setLoadingSources(false);
        }
      });
  }, [activeViewport.iModel, fetchPublicMapLayerSources, hideExternalMapLayersSection, isMounted]);

  React.useEffect(() => {
    const handleLayerSourceChange = async (changeType: MapLayerSourceChangeType, oldSource?: MapLayerSource, newSource?: MapLayerSource) => {
      const removeSource = changeType === MapLayerSourceChangeType.Replaced || changeType === MapLayerSourceChangeType.Removed;
      const addSource = changeType === MapLayerSourceChangeType.Replaced || changeType === MapLayerSourceChangeType.Added;

      let tmpSources = mapSources ? [...mapSources] : undefined;
      if (removeSource) {
        if (oldSource && tmpSources) {
          tmpSources = tmpSources.filter((source) => source.name !== oldSource.name);

          if (changeType !== MapLayerSourceChangeType.Replaced) {
            setMapSources(tmpSources);
          }
        }
      }

      if (addSource) {
        if (tmpSources && newSource && !tmpSources.find((curSource) => newSource.name === curSource.name)) {
          tmpSources.push(newSource);
          tmpSources.sort((a: MapLayerSource, b: MapLayerSource) => compareStrings(a.name.toLowerCase(), b.name.toLowerCase()));
          setMapSources(tmpSources);
        }
      }
    };

    return MapLayerPreferences.onLayerSourceChanged.addListener(handleLayerSourceChange);
  }, [mapSources]);

  return { loadingSources, mapSources };
}
