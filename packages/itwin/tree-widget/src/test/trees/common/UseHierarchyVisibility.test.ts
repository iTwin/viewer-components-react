/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { act } from "react-dom/test-utils";
import sinon from "sinon";
import { BeEvent } from "@itwin/core-bentley";
import { useHierarchyVisibility } from "../../../tree-widget-react/components/trees/common/UseHierarchyVisibility.js";
import { renderHook, waitFor } from "../../TestUtils.js";
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
    dispose: sinon.stub<Parameters<HierarchyVisibilityHandler["dispose"]>, ReturnType<HierarchyVisibilityHandler["dispose"]>>(),
    onVisibilityChange,
  } satisfies HierarchyVisibilityHandler;

  const initialProps: UseHierarchyVisibilityProps = {
    visibilityHandlerFactory: () => visibilityHandler,
  };

  beforeEach(() => {
    visibilityHandler.getVisibilityStatus.reset();
    visibilityHandler.changeVisibility.reset();
    visibilityHandler.dispose.reset();
  });

  it("checks visibility status only once", async () => {
    const node = createPresentationHierarchyNode({ id: "node-1" });
    const { result } = renderHook(useHierarchyVisibility, { initialProps });

    expect(visibilityHandler.getVisibilityStatus).to.not.be.called;
    visibilityHandler.getVisibilityStatus.resolves({ state: "visible" });

    act(() => {
      // expect initial state to be "loading"
      const state = result.current.getCheckboxState(node);
      expect(state).to.deep.eq({ isLoading: true });
    });

    await waitFor(() => {
      // wait for visibility status to be calculated
      expect(visibilityHandler.getVisibilityStatus).to.be.called;
      const state = result.current.getCheckboxState(node);
      expect(state).to.deep.eq({ state: "on" });
    });

    expect(result.current.getCheckboxState(node)).to.deep.eq({ state: "on" });
    expect(visibilityHandler.getVisibilityStatus).to.be.calledOnce;
  });

  it("recalculates node visibility status after visibility changed", async () => {
    const node = createPresentationHierarchyNode({ id: "node-1" });
    const { result } = renderHook(useHierarchyVisibility, { initialProps });

    expect(visibilityHandler.getVisibilityStatus).to.not.be.called;
    visibilityHandler.getVisibilityStatus.resolves({ state: "visible" });

    act(() => {
      // expect initial state to be "loading"
      const state = result.current.getCheckboxState(node);
      expect(state).to.deep.eq({ isLoading: true });
    });

    await waitFor(() => {
      // wait for visibility status to calculated
      expect(visibilityHandler.getVisibilityStatus).to.be.called;
      const state = result.current.getCheckboxState(node);
      expect(state).to.deep.eq({ state: "on" });
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
      const state = result.current.getCheckboxState(node);
      expect(state).to.deep.eq({ state: "on" });
    });

    await waitFor(() => {
      // wait for visibility status to calculated
      expect(visibilityHandler.getVisibilityStatus).to.be.calledTwice;
      const state = result.current.getCheckboxState(node);
      expect(state).to.deep.eq({ state: "partial" });
    });

    expect(result.current.getCheckboxState(node)).to.deep.eq({ state: "partial" });
    expect(visibilityHandler.getVisibilityStatus).to.be.calledTwice;
  });

  it("changes visibility status", async () => {
    const node = createPresentationHierarchyNode({ id: "node-1" });
    const { result } = renderHook(useHierarchyVisibility, { initialProps });

    expect(visibilityHandler.getVisibilityStatus).to.not.be.called;
    visibilityHandler.getVisibilityStatus.resolves({ state: "visible" });

    act(() => {
      // expect initial state to be "loading"
      const state = result.current.getCheckboxState(node);
      expect(state).to.deep.eq({ isLoading: true });
    });

    await waitFor(() => {
      // wait for visibility status to calculated
      expect(visibilityHandler.getVisibilityStatus).to.be.called;
      const state = result.current.getCheckboxState(node);
      expect(state).to.deep.eq({ state: "on" });
    });

    expect(visibilityHandler.getVisibilityStatus).to.be.calledOnce;
    act(() => {
      result.current.onCheckboxClicked(node, false);
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
      // expect visibility state to be optimistically updated to 'off'
      expect(visibilityHandler.getVisibilityStatus).to.be.calledOnce;
      const state = result.current.getCheckboxState(node);
      expect(state).to.deep.eq({ state: "off" });
    });

    await waitFor(() => {
      // wait for visibility status to recalculated
      expect(visibilityHandler.getVisibilityStatus).to.be.calledTwice;
      const state = result.current.getCheckboxState(node);
      expect(state).to.deep.eq({ state: "off" });
    });

    expect(visibilityHandler.getVisibilityStatus).to.be.calledTwice;
  });
});
