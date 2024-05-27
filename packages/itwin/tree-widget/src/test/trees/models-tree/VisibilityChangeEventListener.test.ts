/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { BeEvent, using } from "@itwin/core-bentley";
import { createVisibilityChangeEventListener } from "../../../components/trees/stateless/models-tree/internal/VisibilityChangeEventListener";
import { createFakeSinonViewport } from "../Common";

import type { Viewport } from "@itwin/core-frontend";
describe("VisibilityChangeEventListener", () => {
  it("raises event on `onAlwaysDrawnChanged` event", async () => {
    const evt = new BeEvent();
    const vpMock = createFakeSinonViewport({ onAlwaysDrawnChanged: evt });
    await using(createVisibilityChangeEventListener(vpMock), async (handler) => {
      const spy = sinon.spy();
      handler.onVisibilityChange.addListener(spy);
      evt.raiseEvent(vpMock);
      await new Promise((resolve) => setTimeout(resolve));
      expect(spy).to.be.calledOnce;
    });
  });

  it("raises event on `onNeverDrawnChanged` event", async () => {
    const evt = new BeEvent();
    const vpMock = createFakeSinonViewport({ onNeverDrawnChanged: evt });
    await using(createVisibilityChangeEventListener(vpMock), async (handler) => {
      const spy = sinon.spy();
      handler.onVisibilityChange.addListener(spy);
      evt.raiseEvent(vpMock);
      await new Promise((resolve) => setTimeout(resolve));
      expect(spy).to.be.calledOnce;
    });
  });

  it("raises event on `onViewedCategoriesChanged` event", async () => {
    const evt = new BeEvent();
    const vpMock = createFakeSinonViewport({ onViewedCategoriesChanged: evt });
    await using(createVisibilityChangeEventListener(vpMock), async (handler) => {
      const spy = sinon.spy();
      handler.onVisibilityChange.addListener(spy);
      evt.raiseEvent(vpMock);
      await new Promise((resolve) => setTimeout(resolve));
      expect(spy).to.be.calledOnce;
    });
  });

  it("raises event on `onViewedModelsChanged` event", async () => {
    const evt = new BeEvent();
    const vpMock = createFakeSinonViewport({ onViewedModelsChanged: evt });
    await using(createVisibilityChangeEventListener(vpMock), async (handler) => {
      const spy = sinon.spy();
      handler.onVisibilityChange.addListener(spy);
      evt.raiseEvent(vpMock);
      await new Promise((resolve) => setTimeout(resolve));
      expect(spy).to.be.calledOnce;
    });
  });

  it("raises event on `onViewedCategoriesPerModelChanged` event", async () => {
    const evt = new BeEvent();
    const vpMock = createFakeSinonViewport({ onViewedCategoriesPerModelChanged: evt });
    await using(createVisibilityChangeEventListener(vpMock), async (handler) => {
      const spy = sinon.spy();
      handler.onVisibilityChange.addListener(spy);
      evt.raiseEvent(vpMock);
      await new Promise((resolve) => setTimeout(resolve));
      expect(spy).to.be.calledOnce;
    });
  });

  it("raises event once when multiple affecting events are fired", async () => {
    const evts = {
      onViewedCategoriesPerModelChanged: new BeEvent<(vp: Viewport) => void>(),
      onViewedCategoriesChanged: new BeEvent<(vp: Viewport) => void>(),
      onViewedModelsChanged: new BeEvent<(vp: Viewport) => void>(),
      onAlwaysDrawnChanged: new BeEvent<() => void>(),
      onNeverDrawnChanged: new BeEvent<() => void>(),
    };
    const vpMock = createFakeSinonViewport({ ...evts });
    await using(createVisibilityChangeEventListener(vpMock), async (handler) => {
      const spy = sinon.spy();
      handler.onVisibilityChange.addListener(spy);
      evts.onViewedCategoriesPerModelChanged.raiseEvent(vpMock);
      evts.onViewedCategoriesChanged.raiseEvent(vpMock);
      evts.onViewedModelsChanged.raiseEvent(vpMock);
      evts.onAlwaysDrawnChanged.raiseEvent();
      evts.onNeverDrawnChanged.raiseEvent();
      await new Promise((resolve) => setTimeout(resolve));
      expect(spy).to.be.calledOnce;
    });
  });
});
