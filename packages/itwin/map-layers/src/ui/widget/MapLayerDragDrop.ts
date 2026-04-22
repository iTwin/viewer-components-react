/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { DragEndEvent, UniqueIdentifier } from "@dnd-kit/core";

export const overlayMapLayersId = "overlayMapLayers";
export const backgroundMapLayersId = "backgroundMapLayers";

export type MapLayerDroppableId = typeof overlayMapLayersId | typeof backgroundMapLayersId;

export interface MapLayerDropLocation {
  droppableId: MapLayerDroppableId;
  index: number | undefined;
}

export interface MapLayerDropTargetData {
  droppableId: MapLayerDroppableId;
  index: number | undefined;
}

export function createMapLayerSortableId(droppableId: MapLayerDroppableId, layerName: string, layerIndex: number) {
  return `${droppableId}:${layerIndex}:${layerName}`;
}

export function getMapLayerDropResult(event: DragEndEvent): { source: MapLayerDropLocation; destination?: MapLayerDropLocation } | undefined {
  const source = event.active.data.current as MapLayerDropLocation | undefined;
  if (!source) {
    return undefined;
  }

  if (!event.over) {
    return { source, destination: undefined };
  }

  const destination = event.over.data.current as MapLayerDropTargetData | undefined;
  if (destination) {
    return { source, destination };
  }

  if (!isMapLayerDroppableId(event.over.id)) {
    return { source, destination: undefined };
  }

  return {
    source,
    destination: {
      droppableId: event.over.id,
      index: undefined,
    },
  };
}

function isMapLayerDroppableId(value: UniqueIdentifier): value is MapLayerDroppableId {
  return value === overlayMapLayersId || value === backgroundMapLayersId;
}
