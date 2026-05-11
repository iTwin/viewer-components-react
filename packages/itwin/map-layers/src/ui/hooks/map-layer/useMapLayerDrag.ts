/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import React from "react";
import type { DragEndEvent, DragMoveEvent, DragOverEvent } from "@dnd-kit/react";

import type { ScreenViewport, Viewport } from "@itwin/core-frontend";
import { commitMapLayerDrop } from "../../widget/MapLayerDragModel";
import type { MapLayerDroppableId } from "../../widget/MapLayerDragModel";
import { getMapLayerDragMoveTarget, projectMapLayerDragOver, refreshCommittedMapLayerIndices } from "../../helpers/MapLayerDragProjection";
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
    (event: DragOverEvent) => {
      const projection = projectMapLayerDragOver(mapLayersRef.current, event);
      if (projection.kind === "restore") {
        restoreDragStartMapLayers();
        setDropTargetId(undefined);
        return;
      }

      if (projection.kind === "unchanged") {
        setDropTargetId(projection.targetId);
        return;
      }

      mapLayersRef.current = projection.mapLayers;
      setMapLayers(projection.mapLayers);
      setDropTargetId(projection.targetId);
    },
    [restoreDragStartMapLayers, setMapLayers],
  );

  const handleMapLayerDragMove = React.useCallback(
    (event: DragMoveEvent) => {
      const targetId = getMapLayerDragMoveTarget(event);
      if (!targetId) {
        restoreDragStartMapLayers();
      }
      setDropTargetId(targetId);
    },
    [restoreDragStartMapLayers],
  );

  const handleMapLayerDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      setIsDraggingMapLayer(false);
      suppressReloadRef.current = true;
      const committed = commitMapLayerDrop(activeViewport.displayStyle, mapLayersRef.current, event);
      dragStartMapLayersRef.current = undefined;
      if (committed) {
        mapLayersRef.current = refreshCommittedMapLayerIndices(mapLayersRef.current);
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
    dragStartMapLayers: dragStartMapLayersRef.current,
    dropTargetId,
    handleMapLayerDragEnd,
    handleMapLayerDragMove,
    handleMapLayerDragOver,
    handleMapLayerDragStart,
    isDraggingMapLayer,
  };
}
