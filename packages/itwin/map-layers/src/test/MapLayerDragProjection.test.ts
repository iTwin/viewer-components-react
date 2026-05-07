/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, expect, it, vi } from "vitest";
import { MapTileTreeScaleRangeVisibility } from "@itwin/core-frontend";
import { projectMapLayerDragOver, refreshCommittedMapLayerIndices } from "../ui/helpers/MapLayerDragProjection";
import type { MapLayerState } from "../ui/hooks/map-layer/types";
import type { StyleMapLayerSettings } from "../ui/Interfaces";
import { backgroundMapLayersId, overlayMapLayersId } from "../ui/widget/MapLayerDragModel";

const moveMock = vi.hoisted(() => vi.fn());

vi.mock("@dnd-kit/helpers", () => ({
  move: moveMock,
}));

describe("MapLayerDragProjection", () => {
  function layer(id: string, layerIndex: number): StyleMapLayerSettings {
    return {
      id,
      isOverlay: id.startsWith(overlayMapLayersId),
      layerIndex,
      name: id,
      selected: false,
      showSubLayers: false,
      source: "",
      treeVisibility: MapTileTreeScaleRangeVisibility.Visible,
      transparency: 0,
      transparentBackground: true,
      visible: true,
    };
  }

  function state(background = [layer(`${backgroundMapLayersId}:Background`, 0)], overlay = [layer(`${overlayMapLayersId}:Overlay`, 0)]): MapLayerState {
    return {
      [backgroundMapLayersId]: background,
      [overlayMapLayersId]: overlay,
    };
  }

  function dragOverEvent(sourceId: string, target: { id: string; group?: string } | null) {
    return {
      operation: {
        source: { id: sourceId },
        target,
      },
    } as any;
  }

  it("asks the hook to restore when drag over has no target", () => {
    const result = projectMapLayerDragOver(state(), dragOverEvent(`${backgroundMapLayersId}:Background`, null));

    expect(result).toEqual({ kind: "restore" });
    expect(moveMock).not.toHaveBeenCalled();
  });

  it("does not project same-list container hovers", () => {
    const mapLayers = state();
    const sourceId = `${backgroundMapLayersId}:Background`;
    const result = projectMapLayerDragOver(mapLayers, dragOverEvent(sourceId, { id: backgroundMapLayersId }));

    expect(result).toEqual({ kind: "unchanged", targetId: backgroundMapLayersId });
    expect(moveMock).not.toHaveBeenCalled();
  });

  it("does not project when dnd-kit returns the same layer order", () => {
    const mapLayers = state();
    moveMock.mockReturnValueOnce({
      [backgroundMapLayersId]: [...mapLayers[backgroundMapLayersId]],
      [overlayMapLayersId]: [...mapLayers[overlayMapLayersId]],
    });

    const result = projectMapLayerDragOver(
      mapLayers,
      dragOverEvent(`${backgroundMapLayersId}:Background`, { id: `${overlayMapLayersId}:Overlay`, group: overlayMapLayersId }),
    );

    expect(result).toEqual({ kind: "unchanged", targetId: overlayMapLayersId });
  });

  it("returns the projected layer state when dnd-kit changes the order", () => {
    const mapLayers = state();
    const projected = {
      [backgroundMapLayersId]: [],
      [overlayMapLayersId]: [mapLayers[backgroundMapLayersId][0], ...mapLayers[overlayMapLayersId]],
    };
    moveMock.mockReturnValueOnce(projected);

    const result = projectMapLayerDragOver(mapLayers, dragOverEvent(`${backgroundMapLayersId}:Background`, { id: overlayMapLayersId }));

    expect(result).toEqual({ kind: "project", targetId: overlayMapLayersId, mapLayers: projected });
  });

  it("refreshes display-style indices after a committed optimistic reorder", () => {
    const refreshed = refreshCommittedMapLayerIndices({
      [backgroundMapLayersId]: [
        layer(`${backgroundMapLayersId}:Top`, 0),
        layer(`${backgroundMapLayersId}:Bottom`, 1),
      ],
      [overlayMapLayersId]: [
        layer(`${overlayMapLayersId}:Top`, 0),
        layer(`${overlayMapLayersId}:Middle`, 1),
        layer(`${overlayMapLayersId}:Bottom`, 2),
      ],
    });

    expect(refreshed[backgroundMapLayersId].map((item) => item.layerIndex)).toEqual([1, 0]);
    expect(refreshed[overlayMapLayersId].map((item) => item.layerIndex)).toEqual([2, 1, 0]);
  });
});
