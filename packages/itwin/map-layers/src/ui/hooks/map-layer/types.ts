/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type { DragEndEvent, DragMoveEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/react";
import type { MapLayerSource, ScreenViewport, Viewport } from "@itwin/core-frontend";
import type { StyleMapLayerSettings } from "../../Interfaces";
import type { MapLayerDroppableId } from "../../widget/MapLayerDragModel";

export type MapLayerState = Record<MapLayerDroppableId, StyleMapLayerSettings[]>;

export interface ViewportMapLayersState {
  backgroundMapVisible: boolean;
  setBackgroundMapVisible: Dispatch<SetStateAction<boolean>>;
  loadMapLayerSettingsFromViewport: (viewport: Viewport) => void;
  mapLayers: MapLayerState;
  setMapLayers: Dispatch<SetStateAction<MapLayerState>>;
  suppressReloadRef: MutableRefObject<boolean>;
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
  dragStartMapLayers?: MapLayerState;
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
  setBackgroundMapVisible: Dispatch<SetStateAction<boolean>>;
}
