/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type React from "react";

import { move } from "@dnd-kit/helpers";
import type { DragDropProvider } from "@dnd-kit/react";
import type { StyleMapLayerSettings } from "../../Interfaces";
import { backgroundMapLayersId, getMapLayerDropTargetId, overlayMapLayersId } from "../../widget/MapLayerDragDrop";
import type { MapLayerDroppableId } from "../../widget/MapLayerDragDrop";
import type { MapLayerState } from "./types";

type MapLayerDragOverEvent = Parameters<NonNullable<React.ComponentProps<typeof DragDropProvider>["onDragOver"]>>[0];
type MapLayerDragMoveEvent = Parameters<NonNullable<React.ComponentProps<typeof DragDropProvider>["onDragMove"]>>[0];

export type MapLayerDragProjection =
  | { kind: "restore" }
  | { kind: "unchanged"; targetId: MapLayerDroppableId }
  | { kind: "project"; targetId: MapLayerDroppableId; mapLayers: MapLayerState };

export function getMapLayerDragMoveTarget(event: MapLayerDragMoveEvent): MapLayerDroppableId | undefined {
  return getMapLayerDropTargetId(event.operation.target);
}

export function projectMapLayerDragOver(mapLayers: MapLayerState, event: MapLayerDragOverEvent): MapLayerDragProjection {
  const targetId = getMapLayerDropTargetId(event.operation.target);
  if (!targetId) {
    return { kind: "restore" };
  }

  if (isSameListContainerTarget(event.operation.source?.id, event.operation.target?.id, targetId, mapLayers)) {
    return { kind: "unchanged", targetId };
  }

  const nextMapLayers = move(mapLayers, event);
  if (hasSameMapLayerOrder(mapLayers, nextMapLayers)) {
    return { kind: "unchanged", targetId };
  }

  return { kind: "project", targetId, mapLayers: nextMapLayers };
}

export function refreshCommittedMapLayerIndices(mapLayers: MapLayerState): MapLayerState {
  return {
    [backgroundMapLayersId]: refreshCommittedLayerIndices(mapLayers[backgroundMapLayersId]),
    [overlayMapLayersId]: refreshCommittedLayerIndices(mapLayers[overlayMapLayersId]),
  };
}

function refreshCommittedLayerIndices(layers: StyleMapLayerSettings[]) {
  return layers.map((layer, i, arr) => ({
    ...layer,
    layerIndex: arr.length - 1 - i,
  }));
}

function hasSameMapLayerOrder(a: MapLayerState, b: MapLayerState) {
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
  mapLayers: MapLayerState,
) {
  return targetIdValue === targetId
    && typeof sourceId === "string"
    && mapLayers[targetId].some((layer) => layer.id === sourceId);
}
