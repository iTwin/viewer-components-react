/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BeEvent } from "@itwin/core-bentley";
import { useHierarchyVisibility } from "../../../tree-widget-react/components/trees/common/UseHierarchyVisibility.js";
import { TreeWidget } from "../../../tree-widget-react/TreeWidget.js";
import { act, renderHook, waitFor } from "../../TestUtils.js";
import { createTreeNode } from "../TreeUtils.js";

import type { HierarchyVisibilityHandler } from "../../../tree-widget-react/components/trees/common/UseHierarchyVisibility.js";

type UseHierarchyVisibilityProps = Parameters<typeof useHierarchyVisibility>[0];

describe("useHierarchyVisibility", () => {
  const onVisibilityChange = new BeEvent<() => void>();

  const visibilityHandler = {
    getVisibilityStatus: vi.fn<HierarchyVisibilityHandler["getVisibilityStatus"]>(),
    changeVisibility: vi.fn<HierarchyVisibilityHandler["changeVisibility"]>(),
    [Symbol.dispose]: vi.fn(),
    onVisibilityChange,
  } satisfies HierarchyVisibilityHandler;

  const initialProps: UseHierarchyVisibilityProps = {
    visibilityHandlerFactory: () => visibilityHandler,
  };
  beforeAll(async () => {
    await TreeWidget.initialize();
  });

  beforeEach(() => {
    visibilityHandler.getVisibilityStatus.mockReset();
    visibilityHandler.changeVisibility.mockReset();
    visibilityHandler[Symbol.dispose].mockReset();
  });

  afterAll(() => {
    TreeWidget.terminate();
  });

  it("checks visibility status only once", async () => {
    const node = createTreeNode({ id: "node-1" });
    const { result } = renderHook(useHierarchyVisibility, { initialProps });

    expect(visibilityHandler.getVisibilityStatus).not.toHaveBeenCalled();
    visibilityHandler.getVisibilityStatus.mockResolvedValue({ state: "visible" });

    act(() => {
      // expect initial state to be "loading"
      const state = result.current.getVisibilityButtonState(node);
      expect(state).toEqual({ isLoading: true });
    });

    await waitFor(() => {
      // wait for visibility status to be calculated
      expect(visibilityHandler.getVisibilityStatus).toHaveBeenCalled();
      const state = result.current.getVisibilityButtonState(node);
      expect(state).toEqual({ state: "visible", tooltip: "visibilityTooltips.status.visible" });
    });

    expect(result.current.getVisibilityButtonState(node)).toEqual({ state: "visible", tooltip: "visibilityTooltips.status.visible" });
    expect(visibilityHandler.getVisibilityStatus).toHaveBeenCalledOnce();
  });

  it("recalculates node visibility status after visibility changed", async () => {
    const node = createTreeNode({ id: "node-1" });
    const { result } = renderHook(useHierarchyVisibility, { initialProps });

    expect(visibilityHandler.getVisibilityStatus).not.toHaveBeenCalled();
    visibilityHandler.getVisibilityStatus.mockResolvedValue({ state: "visible" });

    act(() => {
      // expect initial state to be "loading"
      const state = result.current.getVisibilityButtonState(node);
      expect(state).toEqual({ isLoading: true });
    });

    await waitFor(() => {
      // wait for visibility status to calculated
      expect(visibilityHandler.getVisibilityStatus).toHaveBeenCalled();
      const state = result.current.getVisibilityButtonState(node);
      expect(state).toEqual({ state: "visible", tooltip: "visibilityTooltips.status.visible" });
    });

    expect(visibilityHandler.getVisibilityStatus).toHaveBeenCalledOnce();
    act(() => {
      onVisibilityChange.raiseEvent();
    });

    visibilityHandler.getVisibilityStatus.mockResolvedValue({ state: "partial" });

    expect(visibilityHandler.getVisibilityStatus).toHaveBeenCalledOnce();
    act(() => {
      // expect visibility state to be same
      expect(visibilityHandler.getVisibilityStatus).toHaveBeenCalled();
      const state = result.current.getVisibilityButtonState(node);
      expect(state).toEqual({ state: "visible", tooltip: "visibilityTooltips.status.visible" });
    });

    await waitFor(() => {
      // wait for visibility status to calculated
      expect(visibilityHandler.getVisibilityStatus).toHaveBeenCalledTimes(2);
      const state = result.current.getVisibilityButtonState(node);
      expect(state).toEqual({ state: "partial", tooltip: "visibilityTooltips.status.partial" });
    });

    expect(result.current.getVisibilityButtonState(node)).toEqual({ state: "partial", tooltip: "visibilityTooltips.status.partial" });
    expect(visibilityHandler.getVisibilityStatus).toHaveBeenCalledTimes(2);
  });

  it("changes visibility status", async () => {
    const node = createTreeNode({ id: "node-1" });
    const { result } = renderHook(useHierarchyVisibility, { initialProps });

    expect(visibilityHandler.getVisibilityStatus).not.toHaveBeenCalled();
    visibilityHandler.getVisibilityStatus.mockResolvedValue({ state: "visible" });

    act(() => {
      // expect initial state to be "loading"
      const state = result.current.getVisibilityButtonState(node);
      expect(state).toEqual({ isLoading: true });
    });

    await waitFor(() => {
      // wait for visibility status to calculated
      expect(visibilityHandler.getVisibilityStatus).toHaveBeenCalledOnce();
      const state = result.current.getVisibilityButtonState(node);
      expect(state).toEqual({ state: "visible", tooltip: "visibilityTooltips.status.visible" });
    });

    expect(visibilityHandler.getVisibilityStatus).toHaveBeenCalledOnce();
    act(() => {
      result.current.onVisibilityButtonClick(node, "visible");
    });
    expect(visibilityHandler.changeVisibility).toHaveBeenCalled();

    act(() => {
      // expect visibility state to be optimistically updated to 'hidden'
      expect(visibilityHandler.getVisibilityStatus).toHaveBeenCalledOnce();
      const state = result.current.getVisibilityButtonState(node);
      expect(state).toEqual({ state: "hidden", tooltip: "visibilityTooltips.status.determining" });
    });

    visibilityHandler.getVisibilityStatus.mockResolvedValue({ state: "hidden" });

    expect(visibilityHandler.getVisibilityStatus).toHaveBeenCalledOnce();
    act(() => {
      // simulate visibility change by handler
      onVisibilityChange.raiseEvent();
    });

    await waitFor(() => {
      const state = result.current.getVisibilityButtonState(node);
      expect(state).toEqual({ state: "hidden", tooltip: "visibilityTooltips.status.hidden" });
    });

    expect(visibilityHandler.getVisibilityStatus).toHaveBeenCalledTimes(2);
  });

  it("changes visibility status when multiple clicks are made before status can be calculated", async () => {
    const node = createTreeNode({ id: "node-1" });
    const { result } = renderHook(useHierarchyVisibility, { initialProps });

    expect(visibilityHandler.getVisibilityStatus).not.toHaveBeenCalled();
    visibilityHandler.getVisibilityStatus.mockResolvedValue({ state: "visible" });

    act(() => {
      // expect initial state to be "loading"
      const state = result.current.getVisibilityButtonState(node);
      expect(state).toEqual({ isLoading: true });
    });

    await waitFor(() => {
      // wait for visibility status to calculated
      expect(visibilityHandler.getVisibilityStatus).toHaveBeenCalled();
      const state = result.current.getVisibilityButtonState(node);
      expect(state).toEqual({ state: "visible", tooltip: "visibilityTooltips.status.visible" });
    });

    expect(visibilityHandler.getVisibilityStatus).toHaveBeenCalledOnce();
    act(() => {
      result.current.onVisibilityButtonClick(node, "visible");
    });
    expect(visibilityHandler.changeVisibility).toHaveBeenCalledTimes(1);

    act(() => {
      // expect visibility state to be optimistically updated to 'hidden'
      expect(visibilityHandler.getVisibilityStatus).toHaveBeenCalledOnce();
      const state = result.current.getVisibilityButtonState(node);
      expect(state).toEqual({ state: "hidden", tooltip: "visibilityTooltips.status.determining" });
    });

    act(() => {
      result.current.onVisibilityButtonClick(node, "hidden");
    });
    expect(visibilityHandler.changeVisibility).toHaveBeenCalledTimes(2);

    act(() => {
      expect(visibilityHandler.getVisibilityStatus).toHaveBeenCalledOnce();
      const state = result.current.getVisibilityButtonState(node);
      expect(state).toEqual({ state: "visible", tooltip: "visibilityTooltips.status.determining" });
    });

    expect(visibilityHandler.getVisibilityStatus).toHaveBeenCalledOnce();
    visibilityHandler.getVisibilityStatus.mockResolvedValue({ state: "visible" });
    act(() => {
      // simulate visibility change by handler
      onVisibilityChange.raiseEvent();
    });
    await waitFor(() => {
      const state = result.current.getVisibilityButtonState(node);
      expect(state).toEqual({ state: "visible", tooltip: "visibilityTooltips.status.visible" });
    });

    expect(visibilityHandler.getVisibilityStatus).toHaveBeenCalledTimes(2);
  });

  it("optimistically updates children visibility when changing parent visibility", async () => {
    const grandchild = createTreeNode({ id: "grandchild-1" });
    const child = createTreeNode({ id: "child-1", children: [grandchild] });
    const parent = createTreeNode({ id: "parent-1", children: [child] });

    const { result } = renderHook(useHierarchyVisibility, { initialProps });

    visibilityHandler.getVisibilityStatus.mockResolvedValue({ state: "visible" });

    await waitFor(() => {
      expect(result.current.getVisibilityButtonState(parent)).toEqual({ state: "visible", tooltip: "visibilityTooltips.status.visible" });
      expect(result.current.getVisibilityButtonState(child)).toEqual({ state: "visible", tooltip: "visibilityTooltips.status.visible" });
      expect(result.current.getVisibilityButtonState(grandchild)).toEqual({ state: "visible", tooltip: "visibilityTooltips.status.visible" });
    });

    // Toggle parent from visible to hidden
    act(() => {
      result.current.onVisibilityButtonClick(parent, "visible");
    });

    // All descendants should be optimistically set to "hidden"
    act(() => {
      expect(result.current.getVisibilityButtonState(parent)).toEqual({ state: "hidden", tooltip: "visibilityTooltips.status.determining" });
      expect(result.current.getVisibilityButtonState(child)).toEqual({ state: "hidden", tooltip: "visibilityTooltips.status.determining" });
      expect(result.current.getVisibilityButtonState(grandchild)).toEqual({ state: "hidden", tooltip: "visibilityTooltips.status.determining" });
    });

    // Simulate handler reporting actual visibility after change
    visibilityHandler.getVisibilityStatus.mockResolvedValue({ state: "hidden" });

    act(() => {
      onVisibilityChange.raiseEvent();
    });

    // After reconciliation, all nodes should reflect the actual handler state
    await waitFor(() => {
      expect(result.current.getVisibilityButtonState(parent)).toEqual({ state: "hidden", tooltip: "visibilityTooltips.status.hidden" });
      expect(result.current.getVisibilityButtonState(child)).toEqual({ state: "hidden", tooltip: "visibilityTooltips.status.hidden" });
      expect(result.current.getVisibilityButtonState(grandchild)).toEqual({ state: "hidden", tooltip: "visibilityTooltips.status.hidden" });
    });
  });
});
