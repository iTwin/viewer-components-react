/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { UniqueIdentifier } from "@dnd-kit/abstract";
import type { DragEndEvent } from "@dnd-kit/react";

import type { DisplayStyle3dState } from "@itwin/core-frontend";

/**
 * Shared map-layer drag model utilities.
 *
 * This module defines stable droppable IDs, sortable item IDs, target parsing,
 * and the final drop commit into the viewport display style. It intentionally
 * contains no React state or optimistic hover behavior.
 */

export const overlayMapLayersId = "overlayMapLayers";
export const backgroundMapLayersId = "backgroundMapLayers";

export type MapLayerDroppableId = typeof overlayMapLayersId | typeof backgroundMapLayersId;

interface MapLayerDragStateItem {
  id: UniqueIdentifier;
  layerIndex: number;
}

type MapLayerDragState<TItem extends MapLayerDragStateItem> = Record<MapLayerDroppableId, TItem[]>;

interface MapLayerDropTarget {
  id: UniqueIdentifier;
  group?: UniqueIdentifier;
  index?: number;
}

interface MapLayerLocation<TItem extends MapLayerDragStateItem> {
  droppableId: MapLayerDroppableId;
  item: TItem;
  uiIndex: number;
}

type MapLayerDisplayStyle = Pick<
  DisplayStyle3dState,
  "attachMapLayer" | "detachMapLayerByIndex" | "mapLayerAtIndex" | "moveMapLayerToIndex"
>;

export function createMapLayerSortableId(droppableId: MapLayerDroppableId, layerName: string) {
  return `${droppableId}:${layerName}`;
}

export function getMapLayerDroppableId(id: UniqueIdentifier | undefined): MapLayerDroppableId | undefined {
  if (id === undefined) {
    return undefined;
  }

  const idStr = typeof id === "string" ? id : String(id);
  const colon = idStr.indexOf(":");
  const droppableId = colon >= 0 ? idStr.slice(0, colon) : idStr;
  return isMapLayerDroppableId(droppableId) ? droppableId : undefined;
}

export function getMapLayerDropTargetId(target: MapLayerDropTarget | null | undefined): MapLayerDroppableId | undefined {
  if (!target) {
    return undefined;
  }

  return getMapLayerDroppableId(target.group) ?? getMapLayerDroppableId(target.id);
}

export function commitMapLayerDrop<TItem extends MapLayerDragStateItem>(
  displayStyle: MapLayerDisplayStyle,
  mapLayers: MapLayerDragState<TItem>,
  event: DragEndEvent,
): boolean {
  if (event.canceled) {
    return false;
  }

  // Ensure the drop occurred over a valid droppable area.
  // If target is null, the user released outside any droppable, so no-op.
  if (!event.operation.target) {
    return false;
  }

  const draggedId = event.operation.source?.id;
  if (draggedId === undefined || typeof draggedId !== "string") {
    return false;
  }

  // Item IDs are formatted as `${droppableId}:${layerName}`.
  const sourceDroppableId = getMapLayerDroppableId(draggedId);
  if (sourceDroppableId === undefined) {
    return false;
  }

  // Prefer the final target for the destination. Sortable source group/index
  // can describe dnd-kit's projected location, but source.group may still be
  // the original list when rendered lists are not updated optimistically.
  const source = event.operation.source as MapLayerDropTarget | null;
  const target = event.operation.target as MapLayerDropTarget | null;
  const targetDroppableId = getMapLayerDropTargetId(target) ?? getMapLayerDroppableId(source?.group);
  if (targetDroppableId === undefined) {
    return false;
  }

  const destinationDroppableId = targetDroppableId;
  const draggedLocation = findDraggedLocation(mapLayers, draggedId);
  if (!draggedLocation) {
    return false;
  }

  const destinationUiIndex = getDestinationUiIndex(source, target, mapLayers, sourceDroppableId, destinationDroppableId, draggedLocation);
  if (destinationUiIndex === undefined) {
    return false;
  }

  const draggedLayer = draggedLocation.item;
  const sourceIsOverlay = sourceDroppableId === overlayMapLayersId;
  const destinationIsOverlay = destinationDroppableId === overlayMapLayersId;
  // UI arrays are the reverse of display-style order, so:
  //   displayStyleIndex = array.length - 1 - uiIndex
  const sourceDisplayStyleIndex = draggedLayer.layerIndex;
  const destinationLayerCount = mapLayers[destinationDroppableId].length + (draggedLocation.droppableId === destinationDroppableId ? 0 : 1);
  const destinationDisplayStyleIndex = destinationLayerCount - 1 - destinationUiIndex;

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

function findDraggedLocation<TItem extends MapLayerDragStateItem>(
  mapLayers: MapLayerDragState<TItem>,
  draggedId: string,
): MapLayerLocation<TItem> | undefined {
  for (const droppableId of [backgroundMapLayersId, overlayMapLayersId] as const) {
    const uiIndex = mapLayers[droppableId].findIndex((layer) => layer.id === draggedId);
    if (uiIndex >= 0) {
      return { droppableId, item: mapLayers[droppableId][uiIndex], uiIndex };
    }
  }

  return undefined;
}

function isMapLayerDroppableId(value: UniqueIdentifier): value is MapLayerDroppableId {
  return value === overlayMapLayersId || value === backgroundMapLayersId;
}

function getDestinationUiIndex<TItem extends MapLayerDragStateItem>(
  source: MapLayerDropTarget | null,
  target: MapLayerDropTarget | null,
  mapLayers: MapLayerDragState<TItem>,
  sourceDroppableId: MapLayerDroppableId,
  destinationDroppableId: MapLayerDroppableId,
  draggedLocation: MapLayerLocation<TItem>,
): number | undefined {
  const destinationLayerCount = mapLayers[destinationDroppableId].length + (sourceDroppableId === destinationDroppableId ? 0 : 1);
  if (destinationLayerCount <= 0) {
    return undefined;
  }

  if (getMapLayerDropTargetId(target) === destinationDroppableId && typeof target?.index === "number") {
    return clampIndex(target.index, destinationLayerCount);
  }

  if (target?.id === destinationDroppableId) {
    return 0;
  }

  const targetIndex = findTargetUiIndex(mapLayers[destinationDroppableId], target?.id, destinationDroppableId);
  if (targetIndex >= 0) {
    return clampIndex(targetIndex, destinationLayerCount);
  }

  if (draggedLocation.droppableId === destinationDroppableId) {
    return clampIndex(draggedLocation.uiIndex, destinationLayerCount);
  }

  if (getMapLayerDroppableId(source?.group) === destinationDroppableId && typeof source?.index === "number") {
    return clampIndex(source.index, destinationLayerCount);
  }

  return undefined;
}

function findTargetUiIndex<TItem extends MapLayerDragStateItem>(
  layers: TItem[],
  targetId: UniqueIdentifier | undefined,
  destinationDroppableId: MapLayerDroppableId,
) {
  const exactIndex = layers.findIndex((layer) => layer.id === targetId);
  if (exactIndex >= 0 || typeof targetId !== "string") {
    return exactIndex;
  }

  const colon = targetId.indexOf(":");
  if (colon < 0) {
    return -1;
  }

  const destinationSortableId = `${destinationDroppableId}:${targetId.slice(colon + 1)}`;
  return layers.findIndex((layer) => layer.id === destinationSortableId);
}

function clampIndex(index: number, itemCount: number) {
  return Math.max(0, Math.min(index, itemCount - 1));
}
