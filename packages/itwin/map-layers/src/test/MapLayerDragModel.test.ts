/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect, vi } from "vitest";
import {
  backgroundMapLayersId,
  commitMapLayerDrop,
  createMapLayerSortableId,
  getMapLayerDropTargetId,
  getMapLayerDroppableId,
  overlayMapLayersId,
} from "../ui/widget/MapLayerDragModel";

import type { DragEndEvent } from "@dnd-kit/react";
import type { DisplayStyle3dState } from "@itwin/core-frontend";

describe("MapLayerDragModel", () => {
  describe("createMapLayerSortableId", () => {
    it("should create a sortable ID with droppable prefix and layer name", () => {
      const id = createMapLayerSortableId(backgroundMapLayersId, "MyLayer");
      expect(id).toBe("backgroundMapLayers:MyLayer");
    });

    it("should handle overlay layers", () => {
      const id = createMapLayerSortableId(overlayMapLayersId, "OverlayLayer");
      expect(id).toBe("overlayMapLayers:OverlayLayer");
    });
  });

  describe("getMapLayerDroppableId", () => {
    it("should extract a droppable ID from a sortable item ID", () => {
      expect(getMapLayerDroppableId(`${overlayMapLayersId}:OverlayLayer`)).toBe(overlayMapLayersId);
    });

    it("should return a bare droppable ID", () => {
      expect(getMapLayerDroppableId(backgroundMapLayersId)).toBe(backgroundMapLayersId);
    });

    it("should return undefined for unknown IDs", () => {
      expect(getMapLayerDroppableId("other-list:Layer")).toBeUndefined();
    });
  });

  describe("getMapLayerDropTargetId", () => {
    it("should prefer sortable target group over target ID", () => {
      expect(getMapLayerDropTargetId({ id: `${backgroundMapLayersId}:Layer1`, group: overlayMapLayersId })).toBe(overlayMapLayersId);
    });
  });

  describe("commitMapLayerDrop", () => {
    const createMockDisplayStyle = (): DisplayStyle3dState => ({
      moveMapLayerToIndex: vi.fn(),
      detachMapLayerByIndex: vi.fn(),
      attachMapLayer: vi.fn(),
      mapLayerAtIndex: vi.fn().mockReturnValue({}),
    } as any);

    const createMockEvent = (overrides?: Partial<DragEndEvent>): DragEndEvent => ({
      canceled: false,
      operation: {
        source: { id: `${backgroundMapLayersId}:Layer1` },
        target: { id: `${backgroundMapLayersId}` },
      } as any,
      ...overrides,
    } as DragEndEvent);

    it("should return false if drag was canceled", () => {
      const displayStyle = createMockDisplayStyle();
      const event = createMockEvent({ canceled: true });
      const mapLayers = {
        [backgroundMapLayersId]: [],
        [overlayMapLayersId]: [],
      };

      const result = commitMapLayerDrop(displayStyle, mapLayers, event);
      expect(result).toBe(false);
    });

    it("should return false if drop target is null (outside droppables)", () => {
      const displayStyle = createMockDisplayStyle();
      const event = createMockEvent({ operation: { source: { id: `${backgroundMapLayersId}:Layer1` }, target: null } as any });
      const mapLayers = {
        [backgroundMapLayersId]: [{ id: `${backgroundMapLayersId}:Layer1`, layerIndex: 0 }],
        [overlayMapLayersId]: [],
      };

      const result = commitMapLayerDrop(displayStyle, mapLayers, event);
      expect(result).toBe(false);
      expect(displayStyle.moveMapLayerToIndex).not.toHaveBeenCalled();
    });

    it("should return false if optimistic cross-list hover is dropped outside droppables", () => {
      const displayStyle = createMockDisplayStyle();
      const itemId = `${backgroundMapLayersId}:Layer1`;
      const event = createMockEvent({
        operation: {
          source: { id: itemId, group: overlayMapLayersId, index: 0 },
          target: null,
        } as any,
      });
      const mapLayers = {
        [backgroundMapLayersId]: [],
        [overlayMapLayersId]: [{ id: itemId, layerIndex: 0 }],
      };

      const result = commitMapLayerDrop(displayStyle, mapLayers, event);
      expect(result).toBe(false);
      expect(displayStyle.detachMapLayerByIndex).not.toHaveBeenCalled();
      expect(displayStyle.attachMapLayer).not.toHaveBeenCalled();
      expect(displayStyle.moveMapLayerToIndex).not.toHaveBeenCalled();
    });

    it("should return false if source ID is missing or malformed", () => {
      const displayStyle = createMockDisplayStyle();
      const event = createMockEvent({ operation: { source: { id: undefined }, target: { id: backgroundMapLayersId } } as any });
      const mapLayers = {
        [backgroundMapLayersId]: [],
        [overlayMapLayersId]: [],
      };

      const result = commitMapLayerDrop(displayStyle, mapLayers, event);
      expect(result).toBe(false);
    });

    it("should return false if item not found in source list", () => {
      const displayStyle = createMockDisplayStyle();
      const event = createMockEvent();
      const mapLayers = {
        [backgroundMapLayersId]: [],
        [overlayMapLayersId]: [],
      };

      const result = commitMapLayerDrop(displayStyle, mapLayers, event);
      expect(result).toBe(false);
    });

    it("should handle same-list reorder within background layers", () => {
      const displayStyle = createMockDisplayStyle();
      const event = createMockEvent();
      const itemId = `${backgroundMapLayersId}:Layer1`;
      const mapLayers = {
        [backgroundMapLayersId]: [
          { id: itemId, layerIndex: 0 },
          { id: `${backgroundMapLayersId}:Layer2`, layerIndex: 1 },
        ],
        [overlayMapLayersId]: [],
      };

      const result = commitMapLayerDrop(displayStyle, mapLayers, event);
      expect(result).toBe(true);
      // destinationUiIndex = 0, so destinationDisplayStyleIndex = 2 - 1 - 0 = 1
      expect(displayStyle.moveMapLayerToIndex).toHaveBeenCalledWith(0, 1, false);
    });

    it("should handle same-list reorder within overlay layers", () => {
      const displayStyle = createMockDisplayStyle();
      const event = createMockEvent({
        operation: {
          source: { id: `${overlayMapLayersId}:Layer1` },
          target: { id: `${overlayMapLayersId}` },
        } as any,
      });
      const itemId = `${overlayMapLayersId}:Layer1`;
      const mapLayers = {
        [backgroundMapLayersId]: [],
        [overlayMapLayersId]: [
          { id: itemId, layerIndex: 0 },
          { id: `${overlayMapLayersId}:Layer2`, layerIndex: 1 },
        ],
      };

      const result = commitMapLayerDrop(displayStyle, mapLayers, event);
      expect(result).toBe(true);
      // destinationUiIndex = 0, destinationDisplayStyleIndex = 2 - 1 - 0 = 1
      // Layer1 was originally at displayStyle index 0 (UI index 1) and was dragged to UI index 0
      expect(displayStyle.moveMapLayerToIndex).toHaveBeenCalledWith(0, 1, true);
    });

    it("should use final sortable source index for same-list reorder", () => {
      const displayStyle = createMockDisplayStyle();
      const itemId = `${backgroundMapLayersId}:Layer1`;
      const event = createMockEvent({
        operation: {
          source: { id: itemId, group: backgroundMapLayersId, index: 0 },
          target: { id: `${backgroundMapLayersId}:Layer2`, group: backgroundMapLayersId, index: 0 },
        } as any,
      });
      const mapLayers = {
        [backgroundMapLayersId]: [
          { id: `${backgroundMapLayersId}:Layer2`, layerIndex: 1 },
          { id: itemId, layerIndex: 0 },
        ],
        [overlayMapLayersId]: [],
      };

      const result = commitMapLayerDrop(displayStyle, mapLayers, event);
      expect(result).toBe(true);
      expect(displayStyle.moveMapLayerToIndex).toHaveBeenCalledWith(0, 1, false);
    });

    it("should use sortable target index for same-list reorder when source index is unchanged", () => {
      const displayStyle = createMockDisplayStyle();
      const itemId = `${backgroundMapLayersId}:Layer1`;
      const event = createMockEvent({
        operation: {
          source: { id: itemId, group: backgroundMapLayersId, index: 0 },
          target: { id: `${backgroundMapLayersId}:Layer2`, group: backgroundMapLayersId, index: 1 },
        } as any,
      });
      const mapLayers = {
        [backgroundMapLayersId]: [
          { id: itemId, layerIndex: 1 },
          { id: `${backgroundMapLayersId}:Layer2`, layerIndex: 0 },
        ],
        [overlayMapLayersId]: [],
      };

      const result = commitMapLayerDrop(displayStyle, mapLayers, event);
      expect(result).toBe(true);
      expect(displayStyle.moveMapLayerToIndex).toHaveBeenCalledWith(1, 0, false);
    });

    it("should handle cross-list move from background to overlay", () => {
      const displayStyle = createMockDisplayStyle();
      const event = createMockEvent({
        operation: {
          source: { id: `${backgroundMapLayersId}:Layer1`, group: backgroundMapLayersId, index: 0 },
          target: { id: `${overlayMapLayersId}` },
        } as any,
      });
      const itemId = `${backgroundMapLayersId}:Layer1`;
      const mockLayerSettings = { name: "Layer1" };
      (displayStyle.mapLayerAtIndex as any).mockReturnValue(mockLayerSettings);

      const mapLayers = {
        [backgroundMapLayersId]: [{ id: itemId, layerIndex: 0 }],
        [overlayMapLayersId]: [],
      };

      const result = commitMapLayerDrop(displayStyle, mapLayers, event);
      expect(result).toBe(true);
      // sourceIsOverlay = false (background), destinationIsOverlay = true (overlay)
      // sourceDisplayStyleIndex = 0, destinationDisplayStyleIndex = 1 - 1 - 0 = 0
      expect(displayStyle.mapLayerAtIndex).toHaveBeenCalledWith({ index: 0, isOverlay: false });
      expect(displayStyle.detachMapLayerByIndex).toHaveBeenCalledWith({ index: 0, isOverlay: false });
      expect(displayStyle.attachMapLayer).toHaveBeenCalledWith({
        settings: mockLayerSettings,
        mapLayerIndex: { index: 0, isOverlay: true },
      });
    });

    it("should handle optimistic cross-list move from background to overlay", () => {
      const displayStyle = createMockDisplayStyle();
      const itemId = `${backgroundMapLayersId}:Layer1`;
      const event = createMockEvent({
        operation: {
          source: { id: itemId, group: overlayMapLayersId, index: 0 },
          target: { id: itemId, group: overlayMapLayersId, index: 0 },
        } as any,
      });
      const mockLayerSettings = { name: "Layer1" };
      (displayStyle.mapLayerAtIndex as any).mockReturnValue(mockLayerSettings);

      const mapLayers = {
        [backgroundMapLayersId]: [],
        [overlayMapLayersId]: [{ id: itemId, layerIndex: 0 }],
      };

      const result = commitMapLayerDrop(displayStyle, mapLayers, event);
      expect(result).toBe(true);
      expect(displayStyle.mapLayerAtIndex).toHaveBeenCalledWith({ index: 0, isOverlay: false });
      expect(displayStyle.detachMapLayerByIndex).toHaveBeenCalledWith({ index: 0, isOverlay: false });
      expect(displayStyle.attachMapLayer).toHaveBeenCalledWith({
        settings: mockLayerSettings,
        mapLayerIndex: { index: 0, isOverlay: true },
      });
    });

    it("should use sortable target group for cross-list moves", () => {
      const displayStyle = createMockDisplayStyle();
      const event = createMockEvent({
        operation: {
          source: { id: `${backgroundMapLayersId}:Layer1`, group: backgroundMapLayersId, index: 0 },
          target: { id: `${backgroundMapLayersId}:Layer2`, group: overlayMapLayersId },
        } as any,
      });
      const itemId = `${backgroundMapLayersId}:Layer1`;
      const mockLayerSettings = { name: "Layer1" };
      (displayStyle.mapLayerAtIndex as any).mockReturnValue(mockLayerSettings);

      const mapLayers = {
        [backgroundMapLayersId]: [{ id: itemId, layerIndex: 0 }],
        [overlayMapLayersId]: [
          { id: `${overlayMapLayersId}:Layer2`, layerIndex: 1 },
        ],
      };

      const result = commitMapLayerDrop(displayStyle, mapLayers, event);
      expect(result).toBe(true);
      expect(displayStyle.attachMapLayer).toHaveBeenCalledWith({
        settings: mockLayerSettings,
        mapLayerIndex: { index: 1, isOverlay: true },
      });
    });

    it("should handle cross-list move from overlay to background", () => {
      const displayStyle = createMockDisplayStyle();
      const event = createMockEvent({
        operation: {
          source: { id: `${overlayMapLayersId}:Layer1`, group: overlayMapLayersId, index: 0 },
          target: { id: `${backgroundMapLayersId}` },
        } as any,
      });
      const itemId = `${overlayMapLayersId}:Layer1`;
      const mockLayerSettings = { name: "Layer1" };
      (displayStyle.mapLayerAtIndex as any).mockReturnValue(mockLayerSettings);

      const mapLayers = {
        [backgroundMapLayersId]: [],
        [overlayMapLayersId]: [{ id: itemId, layerIndex: 0 }],
      };

      const result = commitMapLayerDrop(displayStyle, mapLayers, event);
      expect(result).toBe(true);
      // sourceIsOverlay = true (overlay), destinationIsOverlay = false (background)
      // sourceDisplayStyleIndex = 0, destinationDisplayStyleIndex = 1 - 1 - 0 = 0
      expect(displayStyle.mapLayerAtIndex).toHaveBeenCalledWith({ index: 0, isOverlay: true });
      expect(displayStyle.detachMapLayerByIndex).toHaveBeenCalledWith({ index: 0, isOverlay: true });
      expect(displayStyle.attachMapLayer).toHaveBeenCalledWith({
        settings: mockLayerSettings,
        mapLayerIndex: { index: 0, isOverlay: false },
      });
    });

    it("should return false if layer is not found in source list", () => {
      const displayStyle = createMockDisplayStyle();
      (displayStyle.mapLayerAtIndex as any).mockReturnValue(null);
      const event = createMockEvent({
        operation: {
          source: { id: `${backgroundMapLayersId}:Layer1`, group: overlayMapLayersId, index: 0 },
          target: { id: `${overlayMapLayersId}` },
        } as any,
      });
      const mapLayers = {
        [backgroundMapLayersId]: [],
        [overlayMapLayersId]: [],
      };

      const result = commitMapLayerDrop(displayStyle, mapLayers, event);
      expect(result).toBe(false);
      expect(displayStyle.detachMapLayerByIndex).not.toHaveBeenCalled();
    });

    it("should commit based on the final sortable source group and index", () => {
      const displayStyle = createMockDisplayStyle();
      const mockLayerSettings = { name: "Layer1" };
      (displayStyle.mapLayerAtIndex as any).mockReturnValue(mockLayerSettings);
      const itemId = `${overlayMapLayersId}:Layer1`;
      const event = createMockEvent({
        operation: {
          source: { id: itemId, group: backgroundMapLayersId, index: 0 },
          target: { id: `${backgroundMapLayersId}` },
        } as any,
      });
      const mapLayers = {
        [backgroundMapLayersId]: [],
        [overlayMapLayersId]: [{ id: itemId, layerIndex: 0 }],
      };

      const result = commitMapLayerDrop(displayStyle, mapLayers, event);
      expect(result).toBe(true);
      expect(displayStyle.moveMapLayerToIndex).not.toHaveBeenCalled();
      expect(displayStyle.detachMapLayerByIndex).toHaveBeenCalledWith({ index: 0, isOverlay: true });
      expect(displayStyle.attachMapLayer).toHaveBeenCalledWith({
        settings: mockLayerSettings,
        mapLayerIndex: { index: 0, isOverlay: false },
      });
    });

    it("should handle no-op reorder to same position", () => {
      const displayStyle = createMockDisplayStyle();
      const event = createMockEvent();
      const itemId = `${backgroundMapLayersId}:Layer1`;
      const mapLayers = {
        [backgroundMapLayersId]: [
          { id: `${backgroundMapLayersId}:Layer2`, layerIndex: 0 },
          { id: itemId, layerIndex: 1 },
        ],
        [overlayMapLayersId]: [],
      };

      const result = commitMapLayerDrop(displayStyle, mapLayers, event);
      expect(result).toBe(false);
      expect(displayStyle.moveMapLayerToIndex).not.toHaveBeenCalled();
    });

    it("should reorder background layer to a lower display-style index", () => {
      const displayStyle = createMockDisplayStyle();
      const itemId = `${backgroundMapLayersId}:Layer1`;
      const event = createMockEvent({
        operation: {
          source: { id: itemId, group: backgroundMapLayersId, index: 1 },
          // Use sortable target index 1 so destination display-style index becomes 0.
          target: { id: `${backgroundMapLayersId}:Layer2`, group: backgroundMapLayersId, index: 1 },
        } as any,
      });
      // Layer1 at uiIndex=1, layerIndex=1 → destinationDisplayStyleIndex = 2-1-1 = 0
      // 1 !== 0, so a real move occurs.
      const mapLayers = {
        [backgroundMapLayersId]: [
          { id: `${backgroundMapLayersId}:Layer2`, layerIndex: 0 },
          { id: itemId, layerIndex: 1 },
        ],
        [overlayMapLayersId]: [],
      };
      const result = commitMapLayerDrop(displayStyle, mapLayers, event);
      expect(result).toBe(true);
      expect(displayStyle.moveMapLayerToIndex).toHaveBeenCalledWith(1, 0, false);
    });
  });
});
