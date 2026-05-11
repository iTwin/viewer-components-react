/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { ImageMapLayerSettings } from "@itwin/core-common";
import { NoRenderApp, NotificationManager } from "@itwin/core-frontend";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { MapLayerManager } from "../ui/widget/MapLayerManager";
import { backgroundMapLayersId, overlayMapLayersId } from "../ui/widget/MapLayerDragModel";
import { TestUtils } from "./TestUtils";
import { ViewportMock } from "./ViewportMock";

const dndKitMock = vi.hoisted(() => ({
  dragDropProviderProps: undefined as any,
  move: vi.fn(),
}));

vi.mock("@dnd-kit/helpers", () => ({
  move: dndKitMock.move,
}));

vi.mock("@dnd-kit/react", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    DragDropProvider: (props: any) => {
      dndKitMock.dragDropProviderProps = props;
      return React.createElement("div", { "data-testid": "drag-drop-provider" }, props.children);
    },
    useDroppable: () => ({
      isDropTarget: false,
      ref: vi.fn(),
    }),
  };
});

vi.mock("@dnd-kit/react/sortable", () => ({
  useSortable: () => ({
    handleRef: vi.fn(),
    isDragging: false,
    ref: vi.fn(),
  }),
}));

describe("MapLayerManager drag and drop", () => {
  const viewportMock = new ViewportMock();

  beforeAll(async () => {
    await NoRenderApp.startup({ notifications: new NotificationManager() });
    await TestUtils.initialize();
  });

  afterAll(() => {
    TestUtils.terminateUiComponents();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    dndKitMock.move.mockReset();
    dndKitMock.dragDropProviderProps = undefined;
    viewportMock.reset();
  });

  function createLayer(name: string) {
    return ImageMapLayerSettings.fromJSON({
      formatId: "WMS",
      name,
      transparentBackground: true,
      url: `https://server/${name}`,
      visible: true,
    });
  }

  async function renderMapLayerManager(backgroundLayerNames: string[], overlayLayerNames: string[] = []) {
    viewportMock.reset();
    viewportMock.backgroundLayers = backgroundLayerNames.map(createLayer);
    viewportMock.overlayLayers = overlayLayerNames.map(createLayer);
    viewportMock.setup();

    render(<MapLayerManager activeViewport={viewportMock.object} />);
    await TestUtils.flushAsyncOperations();
    expect(dndKitMock.dragDropProviderProps).toBeDefined();
  }

  function getLayerSections() {
    return screen.getAllByTestId("map-manager-layer-section");
  }

  function expectLayerInSection(sectionIndex: number, layerName: string) {
    expect(within(getLayerSections()[sectionIndex]).queryByText(layerName)).not.toBeNull();
  }

  function expectLayerNotInSection(sectionIndex: number, layerName: string) {
    expect(within(getLayerSections()[sectionIndex]).queryByText(layerName)).toBeNull();
  }

  function dragEvent(sourceId: string, target: { id: string; group?: string; index?: number } | null) {
    return {
      canceled: false,
      operation: {
        source: { id: sourceId, group: backgroundMapLayersId, index: 0 },
        target,
      },
    } as any;
  }

  it("restores the drag-start layer order when the pointer leaves all droppables", async () => {
    await renderMapLayerManager(["Background"], ["Overlay"]);

    const draggedId = `${backgroundMapLayersId}:Background`;
    dndKitMock.move.mockImplementation((items) => ({
      [backgroundMapLayersId]: [],
      [overlayMapLayersId]: [items[backgroundMapLayersId][0], ...items[overlayMapLayersId]],
    }));

    await act(async () => {
      dndKitMock.dragDropProviderProps.onDragStart();
      dndKitMock.dragDropProviderProps.onDragOver(dragEvent(draggedId, { id: overlayMapLayersId }));
    });
    expectLayerInSection(1, "Background");

    await act(async () => {
      dndKitMock.dragDropProviderProps.onDragMove(dragEvent(draggedId, null));
    });

    expectLayerInSection(0, "Background");
    expectLayerNotInSection(1, "Background");
  });

  it("restores the drag-start layer order after dropping outside any droppable", async () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    };

    try {
      await renderMapLayerManager(["Background"], ["Overlay"]);

      const draggedId = `${backgroundMapLayersId}:Background`;
      dndKitMock.move.mockImplementation((items) => ({
        [backgroundMapLayersId]: [],
        [overlayMapLayersId]: [items[backgroundMapLayersId][0], ...items[overlayMapLayersId]],
      }));

      await act(async () => {
        dndKitMock.dragDropProviderProps.onDragStart();
        dndKitMock.dragDropProviderProps.onDragOver(dragEvent(draggedId, { id: overlayMapLayersId }));
      });
      expectLayerInSection(1, "Background");

      await act(async () => {
        dndKitMock.dragDropProviderProps.onDragEnd(dragEvent(draggedId, null));
      });

      expectLayerInSection(0, "Background");
      expectLayerNotInSection(1, "Background");
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });

  it("projects a layer into a list that was empty at drag start", async () => {
    await renderMapLayerManager(["Background"]);

    const draggedId = `${backgroundMapLayersId}:Background`;
    dndKitMock.move.mockImplementation((items) => ({
      [backgroundMapLayersId]: [],
      [overlayMapLayersId]: [items[backgroundMapLayersId][0]],
    }));

    await act(async () => {
      dndKitMock.dragDropProviderProps.onDragStart();
      dndKitMock.dragDropProviderProps.onDragOver(dragEvent(draggedId, { id: overlayMapLayersId }));
    });

    expectLayerNotInSection(0, "Background");
    expectLayerInSection(1, "Background");
  });
});
