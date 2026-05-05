/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import React from "react";
import type { DragDropProvider } from "@dnd-kit/react";
import { move } from "@dnd-kit/helpers";

import type { ScreenViewport, Viewport } from "@itwin/core-frontend";
import type { StyleMapLayerSettings } from "../../Interfaces";
import { backgroundMapLayersId, commitMapLayerDrop, getMapLayerDropTargetId, overlayMapLayersId } from "../../widget/MapLayerDragDrop";
import type { MapLayerDroppableId } from "../../widget/MapLayerDragDrop";
import type { MapLayerDragStateProps, MapLayerState } from "./types";

/**
 * Manages map-layer drag-and-drop interactions.
 *
 * The hook keeps optimistic local ordering during drag, tracks current drop target,
 * restores state when leaving valid targets, and commits/reloads viewport state
 * after drop completion.
 */
export function useMapLayerDrag(args: {
  activeViewport: ScreenViewport;
  loadMapLayerSettingsFromViewport: (viewport: Viewport) => void;
  mapLayers: MapLayerState;
  setMapLayers: React.Dispatch<React.SetStateAction<MapLayerState>>;
  suppressReloadRef: React.MutableRefObject<boolean>;
}): MapLayerDragStateProps {
  const { activeViewport, loadMapLayerSettingsFromViewport, mapLayers, setMapLayers, suppressReloadRef } = args;
  const mapLayersRef = React.useRef(mapLayers);
  const dragStartMapLayersRef = React.useRef<MapLayerState>();
  const [dropTargetId, setDropTargetId] = React.useState<MapLayerDroppableId>();
  const [isDraggingMapLayer, setIsDraggingMapLayer] = React.useState(false);

  React.useEffect(() => {
    mapLayersRef.current = mapLayers;
  }, [mapLayers]);

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

      const nextMapLayers = move(mapLayersRef.current, event);
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
      suppressReloadRef.current = true;
      const committed = commitMapLayerDrop(activeViewport.displayStyle, mapLayersRef.current, event);
      dragStartMapLayersRef.current = undefined;
      if (committed) {
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
        setTimeout(() => {
          setDropTargetId(undefined);
          suppressReloadRef.current = false;
          loadMapLayerSettingsFromViewport(activeViewport);
        }, 300);
      } else {
        setDropTargetId(undefined);
        suppressReloadRef.current = false;
        requestAnimationFrame(() => loadMapLayerSettingsFromViewport(activeViewport));
      }
    },
    [activeViewport, loadMapLayerSettingsFromViewport, suppressReloadRef],
  );

  return {
    dragStartMapLayersRef,
    dropTargetId,
    handleMapLayerDragEnd,
    handleMapLayerDragMove,
    handleMapLayerDragOver,
    handleMapLayerDragStart,
    isDraggingMapLayer,
  };
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
