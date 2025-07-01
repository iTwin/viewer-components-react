/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { BeEvent } from "@itwin/core-bentley";
import { EmptyLocalization } from "@itwin/core-common";
import { useHierarchyVisibility } from "../../../tree-widget-react/components/trees/common/UseHierarchyVisibility.js";
import { TreeWidget } from "../../../tree-widget-react/TreeWidget.js";
import { act, renderHook, waitFor } from "../../TestUtils.js";
import { createPresentationHierarchyNode } from "../TreeUtils.js";

import type { HierarchyVisibilityHandler } from "../../../tree-widget-react/components/trees/common/UseHierarchyVisibility.js";

type UseHierarchyVisibilityProps = Parameters<typeof useHierarchyVisibility>[0];

describe("useHierarchyVisibility", () => {
  const onVisibilityChange = new BeEvent<() => void>();

  const visibilityHandler = {
    getVisibilityStatus: sinon.stub<
      Parameters<HierarchyVisibilityHandler["getVisibilityStatus"]>,
      ReturnType<HierarchyVisibilityHandler["getVisibilityStatus"]>
    >(),
    changeVisibility: sinon.stub<Parameters<HierarchyVisibilityHandler["changeVisibility"]>, ReturnType<HierarchyVisibilityHandler["changeVisibility"]>>(),
    [Symbol.dispose]: sinon.stub<[], void>(),
    onVisibilityChange,
  } satisfies HierarchyVisibilityHandler;

  const initialProps: UseHierarchyVisibilityProps = {
    visibilityHandlerFactory: () => visibilityHandler,
  };
  before(async () => {
    await TreeWidget.initialize(new EmptyLocalization());
  });

  beforeEach(() => {
    visibilityHandler.getVisibilityStatus.reset();
    visibilityHandler.changeVisibility.reset();
    visibilityHandler[Symbol.dispose].reset();
  });

  after(() => {
    TreeWidget.terminate();
  });

  it("checks visibility status only once", async () => {
    const node = createPresentationHierarchyNode({ id: "node-1" });
    const { result } = renderHook(useHierarchyVisibility, { initialProps });

    expect(visibilityHandler.getVisibilityStatus).to.not.be.called;
    visibilityHandler.getVisibilityStatus.resolves({ state: "visible" });

    act(() => {
      // expect initial state to be visible and disabled
      const state = result.current.getVisibilityButtonState(node);
      expect(state.state).to.be.eq("visible");
      expect(state.isDisabled).to.be.true;
    });

    await waitFor(() => {
      // wait for visibility status to be calculated
      expect(visibilityHandler.getVisibilityStatus).to.be.called;
      const state = result.current.getVisibilityButtonState(node);
      expect(state.state).to.be.eq("visible");
      expect(state.isDisabled).to.be.undefined;
    });

    expect(result.current.getVisibilityButtonState(node).state).to.be.eq("visible");
    expect(visibilityHandler.getVisibilityStatus).to.be.calledOnce;
  });

  it("recalculates node visibility status after visibility changed", async () => {
    const node = createPresentationHierarchyNode({ id: "node-1" });
    const { result } = renderHook(useHierarchyVisibility, { initialProps });

    expect(visibilityHandler.getVisibilityStatus).to.not.be.called;
    visibilityHandler.getVisibilityStatus.resolves({ state: "visible" });

    act(() => {
      // expect initial state to be visible and disabled
      const state = result.current.getVisibilityButtonState(node);
      expect(state.state).to.be.eq("visible");
      expect(state.isDisabled).to.be.true;
    });

    await waitFor(() => {
      // wait for visibility status to calculated
      expect(visibilityHandler.getVisibilityStatus).to.be.called;
      const state = result.current.getVisibilityButtonState(node);
      expect(state.state).to.be.eq("visible");
      expect(state.isDisabled).to.be.undefined;
    });

    expect(visibilityHandler.getVisibilityStatus).to.be.calledOnce;
    act(() => {
      onVisibilityChange.raiseEvent();
    });

    visibilityHandler.getVisibilityStatus.resetBehavior();
    visibilityHandler.getVisibilityStatus.resolves({ state: "partial" });

    expect(visibilityHandler.getVisibilityStatus).to.be.calledOnce;
    act(() => {
      // expect visibility state to be same
      expect(visibilityHandler.getVisibilityStatus).to.be.called;
      const state = result.current.getVisibilityButtonState(node);
      expect(state.state).to.be.eq("visible");
    });

    await waitFor(() => {
      // wait for visibility status to calculated
      expect(visibilityHandler.getVisibilityStatus).to.be.calledTwice;
      const state = result.current.getVisibilityButtonState(node);
      expect(state.state).to.be.eq("partial");
    });

    expect(result.current.getVisibilityButtonState(node).state).to.be.eq("partial");
    expect(visibilityHandler.getVisibilityStatus).to.be.calledTwice;
  });

  it("changes visibility status", async () => {
    const node = createPresentationHierarchyNode({ id: "node-1" });
    const { result } = renderHook(useHierarchyVisibility, { initialProps });

    expect(visibilityHandler.getVisibilityStatus).to.not.be.called;
    visibilityHandler.getVisibilityStatus.resolves({ state: "visible" });

    act(() => {
      // expect initial state to be visible and disabled
      const state = result.current.getVisibilityButtonState(node);
      expect(state.state).to.be.eq("visible");
      expect(state.isDisabled).to.be.true;
    });

    await waitFor(() => {
      // wait for visibility status to calculated
      expect(visibilityHandler.getVisibilityStatus).to.be.called;
      const state = result.current.getVisibilityButtonState(node);
      expect(state.state).to.be.eq("visible");
      expect(state.isDisabled).to.be.undefined;
    });

    expect(visibilityHandler.getVisibilityStatus).to.be.calledOnce;
    act(() => {
      result.current.onVisibilityButtonClick(node, "visible");
    });

    expect(visibilityHandler.changeVisibility).to.be.called;

    visibilityHandler.getVisibilityStatus.resetBehavior();
    visibilityHandler.getVisibilityStatus.resolves({ state: "hidden" });

    expect(visibilityHandler.getVisibilityStatus).to.be.calledOnce;
    act(() => {
      // simulate visibility change by handler
      onVisibilityChange.raiseEvent();
    });

    act(() => {
      // expect visibility state to be optimistically updated to 'visible'
      expect(visibilityHandler.getVisibilityStatus).to.be.calledOnce;
      const state = result.current.getVisibilityButtonState(node);
      expect(state.state).to.be.eq("visible");
    });

    await waitFor(() => {
      // wait for visibility status to recalculated
      expect(visibilityHandler.getVisibilityStatus).to.be.calledTwice;
      const state = result.current.getVisibilityButtonState(node);
      expect(state.state).to.be.eq("hidden");
    });

    expect(visibilityHandler.getVisibilityStatus).to.be.calledTwice;
  });
});
