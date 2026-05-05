/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type React from "react";

import type { DragEndEvent, DragMoveEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/react";
import type { MapLayerSource, ScreenViewport, Viewport } from "@itwin/core-frontend";
import type { StyleMapLayerSettings } from "../../Interfaces";
import type { MapLayerDroppableId } from "../../widget/MapLayerDragDrop";

export type MapLayerState = Record<MapLayerDroppableId, StyleMapLayerSettings[]>;

export interface ViewportMapLayersState {
  backgroundMapVisible: boolean;
  setBackgroundMapVisible: React.Dispatch<React.SetStateAction<boolean>>;
  loadMapLayerSettingsFromViewport: (viewport: Viewport) => void;
  mapLayers: MapLayerState;
  setMapLayers: React.Dispatch<React.SetStateAction<MapLayerState>>;
  suppressReloadRef: React.MutableRefObject<boolean>;
}

export interface MapLayerStyleActions {
  handleLayerVisibilityChange: (mapLayerSettings: StyleMapLayerSettings) => void;
  handleMapLayersToggle: () => void;
  handleOnMenuItemSelection: (action: string, mapLayerSettings: StyleMapLayerSettings) => void;
  handleRefreshFromStyle: () => void;
}

export interface MapLayerSelectionActions {
  handleItemSelected: (isOverlay: boolean, index: number) => void;
  selectAllLayers: (isOverlay: boolean) => void;
}

export interface MapLayerDragStateProps {
  dragStartMapLayersRef: React.MutableRefObject<MapLayerState | undefined>;
  dropTargetId?: MapLayerDroppableId;
  handleMapLayerDragEnd: (event: DragEndEvent) => void;
  handleMapLayerDragMove: (event: DragMoveEvent) => void;
  handleMapLayerDragOver: (event: DragOverEvent) => void;
  handleMapLayerDragStart: (event: DragStartEvent) => void;
  isDraggingMapLayer: boolean;
}

export interface MapLayerSourcesState {
  loadingSources: boolean;
  mapSources: MapLayerSource[] | undefined;
}

export interface MapLayerStyleActionsArgs {
  activeViewport: ScreenViewport;
  backgroundMapVisible: boolean;
  loadMapLayerSettingsFromViewport: (viewport: Viewport) => void;
  setBackgroundMapVisible: React.Dispatch<React.SetStateAction<boolean>>;
}
