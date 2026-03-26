/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { vi } from "vitest";
import { createVisibilityChangeEventListener } from "../../../../tree-widget-react/components/trees/common/internal/VisibilityChangeEventListener.js";
import { waitFor } from "../../../TestUtils.js";
import { createFakeViewport } from "../../Common.js";

describe("VisibilityChangeEventListener", () => {
  it("raises event on `onAlwaysDrawnChanged` event", async () => {
    using vpMock = createFakeViewport();
    using handler = createVisibilityChangeEventListener({
      viewport: vpMock,
      listeners: {
        elements: true,
        categories: true,
        models: true,
      },
    });
    const spy = vi.fn();
    handler.onVisibilityChange.addListener(spy);
    vpMock.onAlwaysDrawnChanged.raiseEvent();
    await waitFor(() => expect(spy).toHaveBeenCalledOnce());
  });

  it("raises event on `onNeverDrawnChanged` event", async () => {
    using vpMock = createFakeViewport();
    using handler = createVisibilityChangeEventListener({
      viewport: vpMock,
      listeners: {
        elements: true,
        categories: true,
        models: true,
      },
    });
    const spy = vi.fn();
    handler.onVisibilityChange.addListener(spy);
    vpMock.onNeverDrawnChanged.raiseEvent();
    await waitFor(() => expect(spy).toHaveBeenCalledOnce());
  });

  it("raises event on `onViewedCategoriesChanged` event", async () => {
    using vpMock = createFakeViewport();
    using handler = createVisibilityChangeEventListener({
      viewport: vpMock,
      listeners: {
        elements: true,
        categories: true,
        models: true,
      },
    });
    const spy = vi.fn();
    handler.onVisibilityChange.addListener(spy);
    vpMock.onDisplayedCategoriesChanged.raiseEvent();
    await waitFor(() => expect(spy).toHaveBeenCalledOnce());
  });

  it("raises event on `onViewedModelsChanged` event", async () => {
    using vpMock = createFakeViewport();
    using handler = createVisibilityChangeEventListener({
      viewport: vpMock,
      listeners: {
        elements: true,
        categories: true,
        models: true,
      },
    });
    const spy = vi.fn();
    handler.onVisibilityChange.addListener(spy);
    vpMock.onDisplayedModelsChanged.raiseEvent();
    await waitFor(() => expect(spy).toHaveBeenCalledOnce());
  });

  it("raises event on `onViewedCategoriesPerModelChanged` event", async () => {
    using vpMock = createFakeViewport();
    using handler = createVisibilityChangeEventListener({
      viewport: vpMock,
      listeners: {
        elements: true,
        categories: true,
        models: true,
      },
    });
    const spy = vi.fn();
    handler.onVisibilityChange.addListener(spy);
    vpMock.onPerModelCategoriesOverridesChanged.raiseEvent();
    await waitFor(() => expect(spy).toHaveBeenCalledOnce());
  });

  it("raises event once when multiple affecting events are fired", async () => {
    using vpMock = createFakeViewport();
    const { onPerModelCategoriesOverridesChanged, onDisplayedCategoriesChanged, onDisplayedModelsChanged, onAlwaysDrawnChanged, onNeverDrawnChanged } = vpMock;
    using handler = createVisibilityChangeEventListener({
      viewport: vpMock,
      listeners: {
        elements: true,
        categories: true,
        models: true,
      },
    });
    const spy = vi.fn();
    handler.onVisibilityChange.addListener(spy);
    onPerModelCategoriesOverridesChanged.raiseEvent();
    onDisplayedCategoriesChanged.raiseEvent();
    onDisplayedModelsChanged.raiseEvent();
    onAlwaysDrawnChanged.raiseEvent();
    onNeverDrawnChanged.raiseEvent();
    await waitFor(() => expect(spy).toHaveBeenCalledOnce());
  });

  it("does not raise event when suppression ends and no viewport events were raised during suppression", async () => {
    using vpMock = createFakeViewport();
    using handler = createVisibilityChangeEventListener({
      viewport: vpMock,
      listeners: { categories: true, displayStyle: true, elements: true, models: true },
    });
    const spy = vi.fn();
    handler.onVisibilityChange.addListener(spy);
    handler.suppressChangeEvents();
    handler.resumeChangeEvents();
    expect(handler.isVisibilityChangePending()).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it("raises event when suppression ends and viewport events were raised during suppression", async () => {
    using vpMock = createFakeViewport();
    const { onPerModelCategoriesOverridesChanged, onDisplayedCategoriesChanged, onDisplayedModelsChanged, onAlwaysDrawnChanged, onNeverDrawnChanged } = vpMock;
    using handler = createVisibilityChangeEventListener({
      viewport: vpMock,
      listeners: { categories: true, displayStyle: true, elements: true, models: true },
    });
    const spy = vi.fn();
    handler.onVisibilityChange.addListener(spy);
    handler.suppressChangeEvents();
    onPerModelCategoriesOverridesChanged.raiseEvent();
    onDisplayedCategoriesChanged.raiseEvent();
    onDisplayedModelsChanged.raiseEvent();
    onAlwaysDrawnChanged.raiseEvent();
    onNeverDrawnChanged.raiseEvent();
    expect(handler.isVisibilityChangePending()).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    handler.resumeChangeEvents();
    expect(handler.isVisibilityChangePending()).toBe(true);
    await waitFor(() => expect(spy).toHaveBeenCalledOnce());
  });

  it("raises event when suppression ends and viewport events were raised after suppression", async () => {
    using vpMock = createFakeViewport();
    const { onPerModelCategoriesOverridesChanged, onDisplayedCategoriesChanged, onDisplayedModelsChanged, onAlwaysDrawnChanged, onNeverDrawnChanged } = vpMock;
    using handler = createVisibilityChangeEventListener({
      viewport: vpMock,
      listeners: { categories: true, displayStyle: true, elements: true, models: true },
    });
    const spy = vi.fn();
    handler.onVisibilityChange.addListener(spy);
    handler.suppressChangeEvents();
    handler.resumeChangeEvents();
    onPerModelCategoriesOverridesChanged.raiseEvent();
    onDisplayedCategoriesChanged.raiseEvent();
    onDisplayedModelsChanged.raiseEvent();
    onAlwaysDrawnChanged.raiseEvent();
    onNeverDrawnChanged.raiseEvent();
    expect(handler.isVisibilityChangePending()).toBe(true);
    await waitFor(() => expect(spy).toHaveBeenCalledOnce());
  });
});
