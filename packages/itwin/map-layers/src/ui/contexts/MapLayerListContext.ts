/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";

import type { ScreenViewport } from "@itwin/core-frontend";
import type { MapLayerOptions, StyleMapLayerSettings } from "../Interfaces";
import type { MapLayerDroppableId } from "../widget/MapLayerDragModel";

/** @internal */
export interface MapLayerListContextProps {
  readonly activeViewport: ScreenViewport;
  readonly backgroundLayers: StyleMapLayerSettings[];
  readonly disabled: boolean;
  readonly dropTargetId?: MapLayerDroppableId;
  readonly isDraggingMapLayer: boolean;
  readonly mapLayerOptions?: MapLayerOptions;
  readonly onItemEdited: () => void;
  readonly onItemSelected: (isOverlay: boolean, index: number) => void;
  readonly onItemVisibilityToggleClicked: (mapLayerSettings: StyleMapLayerSettings) => void;
  readonly onMenuItemSelected: (action: string, mapLayerSettings: StyleMapLayerSettings) => void;
  readonly onSelectAllLayers: (isOverlay: boolean) => void;
  readonly overlayLayers: StyleMapLayerSettings[];
}

/** @internal */
export interface MapLayerListProviderProps extends MapLayerListContextProps {
  readonly children: React.ReactNode;
}

/** @internal */
export const MapLayerListContext = React.createContext<MapLayerListContextProps | undefined>(undefined);

/** @internal */
export function MapLayerListProvider(props: MapLayerListProviderProps): React.ReactElement {
  const value = React.useMemo<MapLayerListContextProps>(
    () => ({
      activeViewport: props.activeViewport,
      backgroundLayers: props.backgroundLayers,
      disabled: props.disabled,
      dropTargetId: props.dropTargetId,
      isDraggingMapLayer: props.isDraggingMapLayer,
      mapLayerOptions: props.mapLayerOptions,
      onItemEdited: props.onItemEdited,
      onItemSelected: props.onItemSelected,
      onItemVisibilityToggleClicked: props.onItemVisibilityToggleClicked,
      onMenuItemSelected: props.onMenuItemSelected,
      onSelectAllLayers: props.onSelectAllLayers,
      overlayLayers: props.overlayLayers,
    }),
    [
      props.activeViewport,
      props.backgroundLayers,
      props.disabled,
      props.dropTargetId,
      props.isDraggingMapLayer,
      props.mapLayerOptions,
      props.onItemEdited,
      props.onItemSelected,
      props.onItemVisibilityToggleClicked,
      props.onMenuItemSelected,
      props.onSelectAllLayers,
      props.overlayLayers,
    ],
  );

  return React.createElement(MapLayerListContext.Provider, { value }, props.children);
}

/** @internal */
export function useMapLayerListContext(): MapLayerListContextProps {
  const context = React.useContext(MapLayerListContext);
  if (!context) {
    throw new Error("useMapLayerListContext must be used within MapLayerListProvider");
  }

  return context;
}
