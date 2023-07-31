/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cSpell:ignore droppable Sublayer Basemap

// the following quiet warning caused by react-beautiful-dnd package
/* eslint-disable @typescript-eslint/unbound-method */

import { BentleyError, compareStrings } from "@itwin/core-bentley";
import { ImageMapLayerSettings, MapImagerySettings, MapSubLayerProps, MapSubLayerSettings } from "@itwin/core-common";
import {
  ImageryMapTileTree, IModelApp, MapLayerImageryProvider, MapLayerScaleRangeVisibility, MapLayerSource, MapLayerSources, NotifyMessageDetails, OutputMessagePriority,
  ScreenViewport, TileTreeOwner, Viewport,
} from "@itwin/core-frontend";
import { ToggleSwitch } from "@itwin/itwinui-react";
import * as React from "react";
import { DragDropContext, DropResult } from "react-beautiful-dnd";
import { MapLayerPreferences, MapLayerSourceChangeType } from "../../MapLayerPreferences";
import { MapLayerOptions, StyleMapLayerSettings } from "../Interfaces";
import { AttachLayerPopupButton } from "./AttachLayerPopupButton";
import { BasemapPanel } from "./BasemapPanel";
import { MapLayerDroppable } from "./MapLayerDroppable";
import "./MapLayerManager.scss";
import { MapLayerSettingsPopupButton } from "./MapLayerSettingsPopupButton";
import { MapLayersUI } from "../../mapLayers";

/** @internal */
export interface SourceMapContextProps {
  readonly sources: MapLayerSource[];
  readonly loadingSources: boolean;
  readonly bases: MapLayerSource[];
  readonly refreshFromStyle: () => void;
  readonly activeViewport?: ScreenViewport;
  readonly backgroundLayers?: StyleMapLayerSettings[];
  readonly overlayLayers?: StyleMapLayerSettings[];
  readonly mapLayerOptions?: MapLayerOptions;
}

/** @internal */
export const SourceMapContext = React.createContext<SourceMapContextProps>({ // eslint-disable-line @typescript-eslint/naming-convention
  sources: [],
  loadingSources: false,
  bases: [],
  refreshFromStyle: () => { },
});

/** @internal */
export function useSourceMapContext(): SourceMapContextProps {
  return React.useContext(SourceMapContext);
}

function getSubLayerProps(subLayerSettings: MapSubLayerSettings[]): MapSubLayerProps[] {
  return subLayerSettings.map((subLayer) => subLayer.toJSON());
}

function getMapLayerSettingsFromViewport(viewport: Viewport, getBackgroundMap: boolean, populateSubLayers = true): StyleMapLayerSettings[] | undefined {
  const displayStyle = viewport.displayStyle;
  if (!displayStyle)
    return undefined;

  const layers = new Array<StyleMapLayerSettings>();

  const displayStyleLayers = (getBackgroundMap ? displayStyle.settings.mapImagery.backgroundLayers : displayStyle.settings.mapImagery.overlayLayers);
  for (let layerIndex = 0; layerIndex < displayStyleLayers.length; layerIndex++) {
    const layerSettings = displayStyleLayers[layerIndex];
    const isOverlay = !getBackgroundMap;
    const layerProvider = viewport.getMapLayerImageryProvider({index: layerIndex, isOverlay});
    const treeVisibility = viewport.getMapLayerScaleRangeVisibility({index: layerIndex, isOverlay});
    const popSubLayers = populateSubLayers && (layerSettings instanceof ImageMapLayerSettings);
    layers.push({
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
    });
  }

  // since we want to display higher level maps above lower maps in UI reverse their order here.
  return layers.reverse();
}

interface MapLayerManagerProps {
  getContainerForClone: () => HTMLElement;
  activeViewport: ScreenViewport;
  mapLayerOptions?: MapLayerOptions;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function MapLayerManager(props: MapLayerManagerProps) {
  const [mapSources, setMapSources] = React.useState<MapLayerSource[] | undefined>();
  const [loadingSources, setLoadingSources] = React.useState(false);
  const [baseSources, setBaseSources] = React.useState<MapLayerSource[] | undefined>();
  const [overlaysLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Widget.OverlayLayers"));
  const [underlaysLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Widget.BackgroundLayers"));
  const { activeViewport, mapLayerOptions } = props;
  const hideExternalMapLayersSection = mapLayerOptions?.hideExternalMapLayers ? mapLayerOptions.hideExternalMapLayers : false;
  const fetchPublicMapLayerSources = mapLayerOptions?.fetchPublicMapLayerSources ? mapLayerOptions.fetchPublicMapLayerSources : false;

  // map layer settings from display style
  const [backgroundMapLayers, setBackgroundMapLayers] = React.useState<StyleMapLayerSettings[] | undefined>(getMapLayerSettingsFromViewport(activeViewport, true));
  const [overlayMapLayers, setOverlayMapLayers] = React.useState<StyleMapLayerSettings[] | undefined>(getMapLayerSettingsFromViewport(activeViewport, false));

  const loadMapLayerSettingsFromViewport = React.useCallback((viewport: Viewport) => {
    setBackgroundMapLayers(getMapLayerSettingsFromViewport(viewport, true));
    setOverlayMapLayers(getMapLayerSettingsFromViewport(viewport, false));
  }, [setBackgroundMapLayers, setOverlayMapLayers]);

  const [backgroundMapVisible, setBackgroundMapVisible] = React.useState(() => {
    if (activeViewport) {
      return activeViewport.viewFlags.backgroundMap;
    }
    return false;
  });

  React.useEffect(() => {
    const updateBackgroundMapVisible = () => setBackgroundMapVisible(activeViewport.viewFlags.backgroundMap);
    return activeViewport.onDisplayStyleChanged.addListener(updateBackgroundMapVisible);
  }, [activeViewport]);

  // 'isMounted' is used to prevent any async operation once the hook has been
  // unloaded.  Otherwise we get a 'Can't perform a React state update on an unmounted component.' warning in the console.
  const isMounted = React.useRef(false);
  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  });

  // Setup onTileTreeLoad events listening.
  // This is needed because we need to know when the imagery provider
  // is created, and be able to monitor to status change.
  React.useEffect(() => {
    const handleTileTreeLoad = (args: TileTreeOwner) => {

      // Ignore non-map tile trees
      if (args.tileTree instanceof ImageryMapTileTree) {
        loadMapLayerSettingsFromViewport(activeViewport);
      }
    };

    return IModelApp.tileAdmin.onTileTreeLoad.addListener(handleTileTreeLoad);

  }, [activeViewport, loadMapLayerSettingsFromViewport]);

  React.useEffect(() => {
    const handleScaleRangeVisibilityChanged = (layerIndexes: MapLayerScaleRangeVisibility[]) => {
      const updateLayers = (array: StyleMapLayerSettings[] | undefined) => {
        if (array === undefined)
          return undefined;

        return array.map((curStyledLayer) => {
          const foundScaleRangeVisibility = layerIndexes.find((layerIdx) => layerIdx.index === curStyledLayer.layerIndex && layerIdx.isOverlay === curStyledLayer.isOverlay);
          if (undefined === foundScaleRangeVisibility)
            return curStyledLayer;
          else
            return { ...curStyledLayer, treeVisibility: foundScaleRangeVisibility.visibility };
        });

      };
      setBackgroundMapLayers(updateLayers(backgroundMapLayers));
      setOverlayMapLayers(updateLayers(overlayMapLayers));

    };

    return activeViewport.onMapLayerScaleRangeVisibilityChanged.addListener(handleScaleRangeVisibilityChanged);

  }, [activeViewport, backgroundMapLayers, loadMapLayerSettingsFromViewport, overlayMapLayers]);

  // Setup onMapImageryChanged events listening.

  React.useEffect(() => {
    const handleMapImageryChanged = (args: Readonly<MapImagerySettings>) => {

      if (args.backgroundLayers.length !== (backgroundMapLayers ? backgroundMapLayers.length : 0)
        || args.overlayLayers.length !== (overlayMapLayers ? overlayMapLayers.length : 0)) {
        loadMapLayerSettingsFromViewport(activeViewport);
      }
    };
    return activeViewport?.displayStyle.settings.onMapImageryChanged.addListener(handleMapImageryChanged);
  }, [activeViewport, backgroundMapLayers, loadMapLayerSettingsFromViewport, overlayMapLayers]);

  const handleProviderStatusChanged = React.useCallback((_args: MapLayerImageryProvider) => {
    loadMapLayerSettingsFromViewport(activeViewport);
  }, [loadMapLayerSettingsFromViewport, activeViewport]);

  // Triggered whenever a provider status change
  React.useEffect(() => {
    backgroundMapLayers?.forEach((layer) => { layer.provider?.onStatusChanged.addListener(handleProviderStatusChanged); });
    overlayMapLayers?.forEach((layer) => { layer.provider?.onStatusChanged.addListener(handleProviderStatusChanged); });

    return () => {
      backgroundMapLayers?.forEach((layer) => { layer.provider?.onStatusChanged.removeListener(handleProviderStatusChanged); });
      overlayMapLayers?.forEach((layer) => { layer.provider?.onStatusChanged.removeListener(handleProviderStatusChanged); });
    };

  }, [backgroundMapLayers, overlayMapLayers, activeViewport, loadMapLayerSettingsFromViewport, handleProviderStatusChanged]);

  // Monitor viewport updates, and refresh the widget accordingly.
  // Note: This is needed for multiple viewport applications.
  React.useEffect(() => {
    // Update background map status
    setBackgroundMapVisible(activeViewport.viewFlags.backgroundMap);

    // Refresh list of layers
    loadMapLayerSettingsFromViewport(activeViewport);

  }, [activeViewport, loadMapLayerSettingsFromViewport]);

  React.useEffect(() => {
    async function fetchSources() {

      let preferenceSources: MapLayerSource[] = [];
      const sourceLayers = await MapLayerSources.create(undefined, (fetchPublicMapLayerSources && !hideExternalMapLayersSection));

      const iModel = activeViewport.iModel;
      try {
        if (iModel?.iTwinId !== undefined) {
          preferenceSources = await MapLayerPreferences.getSources(iModel.iTwinId, iModel.iModelId);
        }
      } catch (err) {
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, IModelApp.localization.getLocalizedString("mapLayers:CustomAttach.ErrorLoadingLayers"), BentleyError.getErrorMessage(err)));
      }

      if (!isMounted.current) {
        return;
      }

      // This is where the list of layers first gets populated...
      const sources: MapLayerSource[] = [];
      const bases: MapLayerSource[] = [];
      const addSource = (source: MapLayerSource) => source.baseMap ? bases.push(source) : sources.push(source);
      sourceLayers?.allSource.forEach(addSource);
      preferenceSources.forEach((source) => {
        // Do not add duplicate
        if (!sources.find((curSource) => source.name === curSource.name))
          addSource(source);
      });
      sources.sort((a: MapLayerSource, b: MapLayerSource) => compareStrings(a.name.toLowerCase(), b.name.toLowerCase()));

      setMapSources(sources);
      setBaseSources(bases);
    }

    setLoadingSources(true);

    fetchSources().then(() => {
      if (isMounted.current) {
        setLoadingSources(false);
      }

    }).catch(() => {
      if (isMounted.current) {
        setLoadingSources(false);
      }
    });
  }, [setMapSources, fetchPublicMapLayerSources, hideExternalMapLayersSection, activeViewport.iModel]);

  /**
  * Handle change events in the MapLayerPreferences
  */
  React.useEffect(() => {
    const handleLayerSourceChange = async (changeType: MapLayerSourceChangeType, oldSource?: MapLayerSource, newSource?: MapLayerSource) => {
      const removeSource = (changeType === MapLayerSourceChangeType.Replaced || changeType === MapLayerSourceChangeType.Removed);
      const addSource = (changeType === MapLayerSourceChangeType.Replaced || changeType === MapLayerSourceChangeType.Added);

      let tmpSources = (mapSources ? [...mapSources] : undefined);
      if (removeSource) {
        if (oldSource && tmpSources) {
          tmpSources = tmpSources.filter((source) =>  source.name !== oldSource.name);

          // We don't update state in case of replacement... it will be done when the source is re-added right after.
          if (changeType !== MapLayerSourceChangeType.Replaced )
            setMapSources(tmpSources);
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

  }, [setMapSources, mapSources]);

  // update when a different display style is loaded.
  React.useEffect(() => {
    const handleDisplayStyleChange = (vp: Viewport) => {
      loadMapLayerSettingsFromViewport(vp);
    };
    return activeViewport?.onDisplayStyleChanged.addListener(handleDisplayStyleChange);
  }, [activeViewport, loadMapLayerSettingsFromViewport]);

  const handleOnMenuItemSelection = React.useCallback((action: string, mapLayerSettings: StyleMapLayerSettings) => {
    if (!activeViewport || !activeViewport.displayStyle)
      return;

    const indexInDisplayStyle = activeViewport.displayStyle.findMapLayerIndexByNameAndSource(mapLayerSettings.name, mapLayerSettings.source, mapLayerSettings.isOverlay);
    if (indexInDisplayStyle < 0)
      return;

    switch (action) {
      case "delete":
        activeViewport.displayStyle.detachMapLayerByIndex({index: indexInDisplayStyle, isOverlay: mapLayerSettings.isOverlay});
        break;
      case "zoom-to-layer":
        activeViewport.viewMapLayerRange({index: indexInDisplayStyle, isOverlay: mapLayerSettings.isOverlay}, activeViewport).then((status) => {
          if (!status) {
            const msg = MapLayersUI.localization.getLocalizedString("mapLayers:Messages.NoRangeDefined");
            IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, `${msg} [${mapLayerSettings.name}]`));
          }
        }).catch((_error) => { });
        break;
    }

    // force UI to update
    loadMapLayerSettingsFromViewport(activeViewport);
  }, [activeViewport, loadMapLayerSettingsFromViewport]);

  const handleLayerVisibilityChange = React.useCallback((mapLayerSettings: StyleMapLayerSettings) => {
    if (activeViewport) {
      const isVisible = !mapLayerSettings.visible;

      const displayStyle = activeViewport.displayStyle;
      const indexInDisplayStyle = displayStyle.findMapLayerIndexByNameAndSource(mapLayerSettings.name, mapLayerSettings.source, mapLayerSettings.isOverlay);
      if (-1 !== indexInDisplayStyle) {
        // update the display style
        displayStyle.changeMapLayerProps({ visible: isVisible }, {index: indexInDisplayStyle, isOverlay: mapLayerSettings.isOverlay});

        // force UI to update
        loadMapLayerSettingsFromViewport(activeViewport);
      }
    }
  }, [activeViewport, loadMapLayerSettingsFromViewport]);

  const handleMapLayersToggle = React.useCallback(() => {
    if (activeViewport) {
      const newState = !backgroundMapVisible;
      activeViewport.viewFlags = activeViewport.viewFlags.with("backgroundMap", newState);
      setBackgroundMapVisible(newState);
    }
  }, [backgroundMapVisible, setBackgroundMapVisible, activeViewport]);

  const handleOnMapLayerDragEnd = React.useCallback((result: DropResult /* ,  _provided: ResponderProvided*/) => {
    const { destination, source } = result;

    if (!destination) // dropped outside of list
      return;

    // item was not moved
    if (destination.droppableId === source.droppableId && destination.index === source.index)
      return;

    let fromMapLayer: StyleMapLayerSettings | undefined;
    if (source.droppableId === "overlayMapLayers" && overlayMapLayers)
      fromMapLayer = overlayMapLayers[source.index];
    else if (source.droppableId === "backgroundMapLayers" && backgroundMapLayers)
      fromMapLayer = backgroundMapLayers[source.index];

    if (!fromMapLayer || !activeViewport)
      return;

    const displayStyle = activeViewport.displayStyle;
    let toMapLayer: StyleMapLayerSettings | undefined;
    let toIndexInDisplayStyle = -1;

    // If destination.index is undefined then the user dropped the map at the end of list of maps. To get the "actual" index in the style, look up index in style by name.
    // We need to do this because the order of layers in UI are reversed so higher layers appear above lower layers.
    if (undefined !== destination.index) {
      if (destination.droppableId === "overlayMapLayers" && overlayMapLayers)
        toMapLayer = overlayMapLayers[destination.index];
      else if (destination.droppableId === "backgroundMapLayers" && backgroundMapLayers)
        toMapLayer = backgroundMapLayers[destination.index];
      if (toMapLayer)
        toIndexInDisplayStyle = displayStyle.findMapLayerIndexByNameAndSource(toMapLayer.name, toMapLayer.source, toMapLayer.isOverlay);
    }

    const fromIndexInDisplayStyle = displayStyle.findMapLayerIndexByNameAndSource(fromMapLayer.name, fromMapLayer.source, fromMapLayer.isOverlay);
    if (fromIndexInDisplayStyle < 0)
      return;

    if (destination.droppableId !== source.droppableId) {
      // see if we moved from "overlayMapLayers" to "backgroundMapLayers" or vice-versa
      const settings = activeViewport.displayStyle.mapLayerAtIndex({index: fromIndexInDisplayStyle, isOverlay: fromMapLayer.isOverlay});
      if (settings) {
        activeViewport.displayStyle.detachMapLayerByIndex({index: fromIndexInDisplayStyle, isOverlay: fromMapLayer.isOverlay});

        // Manually reverse index when moved from one section to the other
        if (fromMapLayer.isOverlay && backgroundMapLayers) {
          toIndexInDisplayStyle = displayStyle.settings.mapImagery.backgroundLayers.length - destination.index;
        } else if (!fromMapLayer.isOverlay && overlayMapLayers) {
          toIndexInDisplayStyle = overlayMapLayers.length - destination.index;
        }

        activeViewport.displayStyle.attachMapLayer({ settings, mapLayerIndex: {isOverlay: !fromMapLayer.isOverlay, index: toIndexInDisplayStyle} });
      }
    } else {
      if (undefined === destination.index) {
        displayStyle.moveMapLayerToBottom({index: fromIndexInDisplayStyle, isOverlay: destination.droppableId === "overlayMapLayers"});
      } else {
        if (toMapLayer) {
          if (toIndexInDisplayStyle !== -1)
            displayStyle.moveMapLayerToIndex(fromIndexInDisplayStyle, toIndexInDisplayStyle, toMapLayer.isOverlay);
        }
      }
    }
    // Note: display style change is automatically applied to view via DisplayStyleState._synchBackgroundMapImagery()
    // So no need to call Viewport.invalidateRenderPlan() here

    // force UI to update
    loadMapLayerSettingsFromViewport(activeViewport);
  }, [loadMapLayerSettingsFromViewport, activeViewport, overlayMapLayers, backgroundMapLayers]);

  const handleRefreshFromStyle = React.useCallback(() => {
    if (activeViewport)
      loadMapLayerSettingsFromViewport(activeViewport);
  }, [activeViewport, loadMapLayerSettingsFromViewport]);

  const [baseMapPanelLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Basemap.BaseMapPanelTitle"));

  return (
    <SourceMapContext.Provider value={{
      activeViewport,
      loadingSources,
      sources: mapSources ? mapSources : [],
      bases: baseSources ? baseSources : [],
      refreshFromStyle: handleRefreshFromStyle,
      backgroundLayers: backgroundMapLayers,
      overlayLayers: overlayMapLayers,
      mapLayerOptions,
    }}>
      <div className="map-manager-top-header">
        <span className="map-manager-header-label">{baseMapPanelLabel}</span>
        <div className="map-manager-header-buttons-group">
          <ToggleSwitch className="map-manager-toggle" checked={backgroundMapVisible} onChange={handleMapLayersToggle} />
          <MapLayerSettingsPopupButton disabled={!backgroundMapVisible} />
        </div>
      </div>

      <div className="map-manager-container">

        <div className="map-manager-basemap">
          <BasemapPanel disabled={!backgroundMapVisible} />
        </div>
        {!hideExternalMapLayersSection &&
          <DragDropContext onDragEnd={handleOnMapLayerDragEnd}>
            <div className="map-manager-layer-wrapper">
              <div className="map-manager-underlays" >
                <span className="map-manager-underlays-label">{underlaysLabel}</span><AttachLayerPopupButton disabled={!backgroundMapVisible} isOverlay={false} />
              </div>
              <MapLayerDroppable
                disabled={!backgroundMapVisible}
                isOverlay={false}
                layersList={backgroundMapLayers}
                mapTypesOptions={props.mapLayerOptions?.mapTypeOptions}
                getContainerForClone={props.getContainerForClone as any}
                activeViewport={props.activeViewport}
                onMenuItemSelected={handleOnMenuItemSelection}
                onItemVisibilityToggleClicked={handleLayerVisibilityChange}
                onItemEdited={handleRefreshFromStyle} />
            </div>

            <div className="map-manager-layer-wrapper">
              <div className="map-manager-overlays" >
                <span className="map-manager-overlays-label">{overlaysLabel}</span><AttachLayerPopupButton disabled={!backgroundMapVisible} isOverlay={true} />
              </div>
              <MapLayerDroppable
                disabled={!backgroundMapVisible}
                isOverlay={true}
                layersList={overlayMapLayers}
                mapTypesOptions={props.mapLayerOptions?.mapTypeOptions}
                getContainerForClone={props.getContainerForClone as any}
                activeViewport={props.activeViewport}
                onMenuItemSelected={handleOnMenuItemSelection}
                onItemVisibilityToggleClicked={handleLayerVisibilityChange}
                onItemEdited={handleRefreshFromStyle} />
            </div>
          </DragDropContext>
        }
      </div >
    </SourceMapContext.Provider >
  );
}

