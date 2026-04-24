/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { UniqueIdentifier } from "@dnd-kit/abstract";
import type { DragEndEvent } from "@dnd-kit/react";

import type { DisplayStyle3dState } from "@itwin/core-frontend";

export const overlayMapLayersId = "overlayMapLayers";
export const backgroundMapLayersId = "backgroundMapLayers";

export type MapLayerDroppableId = typeof overlayMapLayersId | typeof backgroundMapLayersId;

export interface MapLayerDropLocation {
  droppableId: MapLayerDroppableId;
  index: number | undefined;
}

interface MapLayerDragStateItem {
  id: UniqueIdentifier;
  layerIndex: number;
}

type MapLayerDragState<TItem extends MapLayerDragStateItem> = Record<MapLayerDroppableId, TItem[]>;

type MapLayerDisplayStyle = Pick<
  DisplayStyle3dState,
  "attachMapLayer" | "detachMapLayerByIndex" | "mapLayerAtIndex" | "moveMapLayerToIndex"
>;

export function createMapLayerSortableId(droppableId: MapLayerDroppableId, layerName: string) {
  return `${droppableId}:${layerName}`;
}

export function commitMapLayerDrop<TItem extends MapLayerDragStateItem>(
  displayStyle: MapLayerDisplayStyle,
  mapLayers: MapLayerDragState<TItem>,
  event: DragEndEvent,
): boolean {
  if (event.canceled) {
    return false;
  }

  const draggedId = event.operation.source?.id;
  if (draggedId === undefined || typeof draggedId !== "string") {
    return false;
  }

  // Item IDs are formatted as `${droppableId}:${layerName}`.
  // Parse the source droppable ID directly from the ID so we never depend on
  // event.operation.target (which is often null at drag-end time).
  const firstColon = draggedId.indexOf(":");
  if (firstColon < 0) {
    return false;
  }
  const sourceDroppableId = draggedId.slice(0, firstColon);
  if (!isMapLayerDroppableId(sourceDroppableId)) {
    return false;
  }

  // Locate the dragged item in the post-drag-over state to find its destination.
  for (const destinationDroppableId of [backgroundMapLayersId, overlayMapLayersId] as const) {
    const layers = mapLayers[destinationDroppableId];
    const destinationUiIndex = layers.findIndex((l) => l.id === draggedId);
    if (destinationUiIndex < 0) {
      continue;
    }

    const draggedLayer = layers[destinationUiIndex];
    const sourceIsOverlay = sourceDroppableId === overlayMapLayersId;
    const destinationIsOverlay = destinationDroppableId === overlayMapLayersId;
    // UI arrays are the reverse of display-style order, so:
    //   displayStyleIndex = array.length - 1 - uiIndex
    const sourceDisplayStyleIndex = draggedLayer.layerIndex;
    const destinationDisplayStyleIndex = layers.length - 1 - destinationUiIndex;

    if (sourceIsOverlay === destinationIsOverlay) {
      if (sourceDisplayStyleIndex === destinationDisplayStyleIndex) {
        return false;
      }
      displayStyle.moveMapLayerToIndex(sourceDisplayStyleIndex, destinationDisplayStyleIndex, sourceIsOverlay);
    } else {
      const layerSettings = displayStyle.mapLayerAtIndex({ index: sourceDisplayStyleIndex, isOverlay: sourceIsOverlay });
      if (!layerSettings) {
        return false;
      }
      displayStyle.detachMapLayerByIndex({ index: sourceDisplayStyleIndex, isOverlay: sourceIsOverlay });
      displayStyle.attachMapLayer({
        settings: layerSettings,
        mapLayerIndex: { index: destinationDisplayStyleIndex, isOverlay: destinationIsOverlay },
      });
    }
    return true;
  }

  return false;
}

function isMapLayerDroppableId(value: UniqueIdentifier): value is MapLayerDroppableId {
  return value === overlayMapLayersId || value === backgroundMapLayersId;
}
