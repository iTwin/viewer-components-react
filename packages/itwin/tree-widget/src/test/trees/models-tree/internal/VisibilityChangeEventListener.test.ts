/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { createVisibilityChangeEventListener } from "../../../../tree-widget-react/components/trees/models-tree/internal/VisibilityChangeEventListener.js";
import { waitFor } from "../../../TestUtils.js";
import { createFakeSinonViewport } from "../../Common.js";

describe("VisibilityChangeEventListener", () => {
  it("raises event on `onAlwaysDrawnChanged` event", async () => {
    const vpMock = createFakeSinonViewport();
    using handler = createVisibilityChangeEventListener(vpMock);
    const spy = sinon.spy();
    handler.onVisibilityChange.addListener(spy);
    vpMock.onAlwaysDrawnChanged.raiseEvent(vpMock);
  });

  it("raises event on `onNeverDrawnChanged` event", async () => {
    const vpMock = createFakeSinonViewport();
    using handler = createVisibilityChangeEventListener(vpMock);
    const spy = sinon.spy();
    handler.onVisibilityChange.addListener(spy);
    vpMock.onNeverDrawnChanged.raiseEvent(vpMock);
    await waitFor(() => expect(spy).to.be.calledOnce);
  });

  it("raises event on `onViewedCategoriesChanged` event", async () => {
    const vpMock = createFakeSinonViewport();
    using handler = createVisibilityChangeEventListener(vpMock);
    const spy = sinon.spy();
    handler.onVisibilityChange.addListener(spy);
    vpMock.onViewedCategoriesChanged.raiseEvent(vpMock);
    await waitFor(() => expect(spy).to.be.calledOnce);
  });

  it("raises event on `onViewedModelsChanged` event", async () => {
    const vpMock = createFakeSinonViewport();
    using handler = createVisibilityChangeEventListener(vpMock);
    const spy = sinon.spy();
    handler.onVisibilityChange.addListener(spy);
    vpMock.onViewedModelsChanged.raiseEvent(vpMock);
    await waitFor(() => expect(spy).to.be.calledOnce);
  });

  it("raises event on `onViewedCategoriesPerModelChanged` event", async () => {
    const vpMock = createFakeSinonViewport();
    using handler = createVisibilityChangeEventListener(vpMock);
    const spy = sinon.spy();
    handler.onVisibilityChange.addListener(spy);
    vpMock.onViewedCategoriesPerModelChanged.raiseEvent(vpMock);
    await waitFor(() => expect(spy).to.be.calledOnce);
  });

  it("raises event once when multiple affecting events are fired", async () => {
    const vpMock = createFakeSinonViewport();
    const { onViewedCategoriesPerModelChanged, onViewedCategoriesChanged, onViewedModelsChanged, onAlwaysDrawnChanged, onNeverDrawnChanged } = vpMock;
    using handler = createVisibilityChangeEventListener(vpMock);
    const spy = sinon.spy();
    handler.onVisibilityChange.addListener(spy);
    onViewedCategoriesPerModelChanged.raiseEvent(vpMock);
    onViewedCategoriesChanged.raiseEvent(vpMock);
    onViewedModelsChanged.raiseEvent(vpMock);
    onAlwaysDrawnChanged.raiseEvent(vpMock);
    onNeverDrawnChanged.raiseEvent(vpMock);
    await waitFor(() => expect(spy).to.be.calledOnce);
  });

  it("does not raise event when suppression ends and no viewport events were raised during suppression", async () => {
    const vpMock = createFakeSinonViewport();
    using handler = createVisibilityChangeEventListener(vpMock);
    const spy = sinon.spy();
    handler.onVisibilityChange.addListener(spy);
    handler.suppressChangeEvents();
    handler.resumeChangeEvents();
    expect(handler.isVisibilityChangePending()).to.be.false;
    expect(spy).to.not.be.called;
  });

  it("raises event when suppression ends and viewport events were raised during suppression", async () => {
    const vpMock = createFakeSinonViewport();
    const { onViewedCategoriesPerModelChanged, onViewedCategoriesChanged, onViewedModelsChanged, onAlwaysDrawnChanged, onNeverDrawnChanged } = vpMock;
    using handler = createVisibilityChangeEventListener(vpMock);
    const spy = sinon.spy();
    handler.onVisibilityChange.addListener(spy);
    handler.suppressChangeEvents();
    onViewedCategoriesPerModelChanged.raiseEvent(vpMock);
    onViewedCategoriesChanged.raiseEvent(vpMock);
    onViewedModelsChanged.raiseEvent(vpMock);
    onAlwaysDrawnChanged.raiseEvent(vpMock);
    onNeverDrawnChanged.raiseEvent(vpMock);
    expect(handler.isVisibilityChangePending()).to.be.false;
    expect(spy).to.not.be.called;
    handler.resumeChangeEvents();
    expect(handler.isVisibilityChangePending()).to.be.true;
    await waitFor(() => expect(spy).to.be.calledOnce);
  });

  it("raises event when suppression ends and viewport events were raised after suppression", async () => {
    const vpMock = createFakeSinonViewport();
    const { onViewedCategoriesPerModelChanged, onViewedCategoriesChanged, onViewedModelsChanged, onAlwaysDrawnChanged, onNeverDrawnChanged } = vpMock;
    using handler = createVisibilityChangeEventListener(vpMock);
    const spy = sinon.spy();
    handler.onVisibilityChange.addListener(spy);
    handler.suppressChangeEvents();
    handler.resumeChangeEvents();
    onViewedCategoriesPerModelChanged.raiseEvent(vpMock);
    onViewedCategoriesChanged.raiseEvent(vpMock);
    onViewedModelsChanged.raiseEvent(vpMock);
    onAlwaysDrawnChanged.raiseEvent(vpMock);
    onNeverDrawnChanged.raiseEvent(vpMock);
    expect(handler.isVisibilityChangePending()).to.be.true;
    await waitFor(() => expect(spy).to.be.calledOnce);
  });
});
