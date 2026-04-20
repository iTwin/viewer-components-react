/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { EMPTY, of, Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVisibilityStatus } from "../../../../../tree-widget-react/components/trees/common/internal/Tooltip.js";
import { HierarchyVisibilityHandlerImpl } from "../../../../../tree-widget-react/components/trees/common/internal/useTreeHooks/UseCachedVisibility.js";
import { createFakeViewport } from "../../../Common.js";

import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { HierarchyVisibilityHandlerImplProps } from "../../../../../tree-widget-react/components/trees/common/internal/useTreeHooks/UseCachedVisibility.js";
import type { TreeSpecificVisibilityHandler } from "../../../../../tree-widget-react/components/trees/common/internal/visibility/BaseVisibilityHelper.js";
import type { VisibilityStatus } from "../../../../../tree-widget-react/components/trees/common/UseHierarchyVisibility.js";

function createNode(props?: { instanceKeys?: Array<{ className: string; id: string }>; parentKeys?: HierarchyNode["parentKeys"] }): HierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: props?.instanceKeys ?? [{ className: "BisCore.Element", id: "0x1" }],
    },
    parentKeys: props?.parentKeys ?? [],
    label: "test",
    children: false,
  } as HierarchyNode;
}

function createTreeSpecificVisibilityHandler(
  overrides?: Partial<TreeSpecificVisibilityHandler<void> & Disposable>,
): TreeSpecificVisibilityHandler<void> & Disposable {
  return {
    getVisibilityStatus: vi.fn(() => of(createVisibilityStatus("visible"))),
    changeVisibilityStatus: vi.fn(() => EMPTY),
    getSearchTargetsVisibilityStatus: vi.fn(() => EMPTY),
    changeSearchTargetsVisibilityStatus: vi.fn(() => EMPTY),
    [Symbol.dispose]: vi.fn(),
    ...overrides,
  };
}

function setupTest(overrides?: {
  visibilityHandler?: Partial<TreeSpecificVisibilityHandler<void> & Disposable>;
  viewport?: ReturnType<typeof createFakeViewport>;
  getTreeSpecificVisibilityHandler?: HierarchyVisibilityHandlerImplProps<void>["getTreeSpecificVisibilityHandler"];
  cancelChangesInProgress?: Subject<void>;
  updateChangesInProgress?: HierarchyVisibilityHandlerImplProps<void>["updateChangesInProgress"];
}) {
  const viewport = overrides?.viewport ?? createFakeViewport();
  const cancelChangesInProgress = overrides?.cancelChangesInProgress ?? new Subject<void>();
  const updateChangesInProgress = overrides?.updateChangesInProgress ?? vi.fn();
  const defaultVisibilityHandler = createTreeSpecificVisibilityHandler(overrides?.visibilityHandler);
  const handler = new HierarchyVisibilityHandlerImpl<void>({
    viewport,
    getTreeSpecificVisibilityHandler: overrides?.getTreeSpecificVisibilityHandler ?? (() => defaultVisibilityHandler),
    getSearchResultsTree: () => undefined,
    cancelChangesInProgress,
    updateChangesInProgress,
  });
  return {
    handler,
    viewport,
    visibilityHandler: defaultVisibilityHandler,
    cancelChangesInProgress,
    updateChangesInProgress,
    [Symbol.dispose]: () => handler[Symbol.dispose](),
  };
}

describe("HierarchyVisibilityHandlerImpl", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getVisibilityStatus", () => {
    it("returns status from tree-specific handler", async () => {
      const expectedStatus = createVisibilityStatus("visible");
      using setup = setupTest({
        visibilityHandler: {
          getVisibilityStatus: vi.fn(() => of(expectedStatus)),
        },
      });
      const { handler } = setup;

      const result = await handler.getVisibilityStatus(createNode());

      expect(result).toEqual(expectedStatus);
    });

    it("returns disabled status when change request arrives for same node before status completes", async () => {
      const statusSubject = new Subject<VisibilityStatus>();
      using setup = setupTest({
        visibilityHandler: {
          getVisibilityStatus: vi.fn(() => statusSubject),
        },
      });
      const { handler } = setup;

      const node = createNode();
      const statusPromise = handler.getVisibilityStatus(node);

      // Trigger a change request for the same node — the takeUntil fires and the status observable completes empty
      await handler.changeVisibility(node, true);

      const result = await statusPromise;
      expect(result).toEqual({ state: "visible", isDisabled: true });
    });

    it("returns disabled status when visibility change event fires before status completes", async () => {
      const statusSubject = new Subject<VisibilityStatus>();
      using setup = setupTest({
        visibilityHandler: {
          getVisibilityStatus: vi.fn(() => statusSubject),
        },
      });
      const { handler, viewport } = setup;

      const statusPromise = handler.getVisibilityStatus(createNode());

      // Fire a viewport event that triggers the visibility change event listener
      viewport.onDisplayedModelsChanged.raiseEvent();
      // The event listener uses setTimeout debouncing — advance timers to flush it
      await vi.advanceTimersByTimeAsync(0);

      const result = await statusPromise;
      expect(result).toEqual({ state: "visible", isDisabled: true });
    });

    it("does not cancel status for change request on a different node", async () => {
      const statusSubject = new Subject<VisibilityStatus>();
      using setup = setupTest({
        visibilityHandler: {
          getVisibilityStatus: vi.fn(() => statusSubject),
        },
      });
      const { handler } = setup;

      const nodeA = createNode({ instanceKeys: [{ className: "BisCore.Element", id: "0x1" }] });
      const nodeB = createNode({ instanceKeys: [{ className: "BisCore.Element", id: "0x2" }] });

      const statusPromise = handler.getVisibilityStatus(nodeA);

      // Change visibility for a different node — should NOT cancel nodeA's status
      await handler.changeVisibility(nodeB, true);

      // Now emit a value from the subject — the promise should resolve with it
      const expectedStatus = createVisibilityStatus("hidden");
      statusSubject.next(expectedStatus);
      statusSubject.complete();

      const result = await statusPromise;
      expect(result).toEqual(expectedStatus);
    });

    it("does not cancel status for change request on same key but different depth", async () => {
      const statusSubject = new Subject<VisibilityStatus>();
      using setup = setupTest({
        visibilityHandler: {
          getVisibilityStatus: vi.fn(() => statusSubject),
        },
      });
      const { handler } = setup;

      const nodeA = createNode({ parentKeys: [] }); // depth 0
      const nodeB = createNode({ parentKeys: [{ type: "instances", instanceKeys: [{ className: "BisCore.Element", id: "0x99" }] }] }); // depth 1

      const statusPromise = handler.getVisibilityStatus(nodeA);

      // Change visibility for same key but different depth — should NOT cancel nodeA's status
      await handler.changeVisibility(nodeB, true);

      const expectedStatus = createVisibilityStatus("visible");
      statusSubject.next(expectedStatus);
      statusSubject.complete();

      const result = await statusPromise;
      expect(result).toEqual(expectedStatus);
    });
  });

  describe("changeVisibility", () => {
    it("commits buffered changes to real viewport on normal completion", async () => {
      const vp = createFakeViewport();
      using setup = setupTest({
        viewport: vp,
        getTreeSpecificVisibilityHandler: ({ viewport }) => {
          return createTreeSpecificVisibilityHandler({
            changeVisibilityStatus: vi.fn(() => {
              viewport.changeModelDisplay({ modelIds: "0x1", display: true });
              return EMPTY;
            }),
          });
        },
      });
      const { handler } = setup;

      await handler.changeVisibility(createNode(), true);

      expect(vp.changeModelDisplay).toHaveBeenCalledWith({ modelIds: "0x1", display: true });
    });

    it("does not apply changes to real viewport before observable completes", async () => {
      const vp = createFakeViewport();
      const changeSubject = new Subject<void>();
      using setup2 = setupTest({
        viewport: vp,
        getTreeSpecificVisibilityHandler: ({ viewport }) => {
          return createTreeSpecificVisibilityHandler({
            changeVisibilityStatus: vi.fn(() => {
              viewport.changeModelDisplay({ modelIds: "0x1", display: true });
              return changeSubject;
            }),
          });
        },
      });
      const { handler } = setup2;

      const changePromise = handler.changeVisibility(createNode(), true);

      // Observable hasn't completed yet — real viewport should not have been called
      expect(vp.changeModelDisplay).not.toHaveBeenCalled();

      // Now complete the observable
      changeSubject.complete();
      await changePromise;

      // Now it should have been called via commit
      expect(vp.changeModelDisplay).toHaveBeenCalledWith({ modelIds: "0x1", display: true });
    });

    it("discards partial changes when takeUntil fires for same node", async () => {
      const vp = createFakeViewport();
      const firstChangeSubject = new Subject<void>();
      const getTreeSpecificVisibilityHandler = vi
        .fn<HierarchyVisibilityHandlerImplProps<void>["getTreeSpecificVisibilityHandler"]>()
        .mockImplementationOnce(({ viewport: bufferingViewport }) =>
          createTreeSpecificVisibilityHandler({
            changeVisibilityStatus: vi.fn(() => {
              bufferingViewport.changeModelDisplay({ modelIds: "0x1", display: true });
              return firstChangeSubject;
            }),
          }),
        )
        .mockImplementation(() => createTreeSpecificVisibilityHandler());
      using setup = setupTest({
        viewport: vp,
        getTreeSpecificVisibilityHandler,
      });
      const { handler } = setup;

      const node = createNode();

      // Start first change — don't await
      const firstPromise = handler.changeVisibility(node, true);

      // Start second change for same node — triggers takeUntil on the first
      const secondPromise = handler.changeVisibility(node, true);

      // Both should resolve (first completes via takeUntil, second completes normally)
      await firstPromise;
      await secondPromise;

      // takeUntil triggers cancellation — partial changes are discarded, NOT applied
      expect(vp.changeModelDisplay).not.toHaveBeenCalled();
    });

    it("applies changes when a different node completes", async () => {
      const vp = createFakeViewport();
      const firstChangeSubject = new Subject<void>();
      const getTreeSpecificVisibilityHandler = vi
        .fn<HierarchyVisibilityHandlerImplProps<void>["getTreeSpecificVisibilityHandler"]>()
        .mockImplementationOnce(({ viewport: bufferingViewport }) =>
          createTreeSpecificVisibilityHandler({
            changeVisibilityStatus: vi.fn(() => {
              bufferingViewport.changeModelDisplay({ modelIds: "0xFIRST", display: true });
              return firstChangeSubject;
            }),
          }),
        )
        .mockImplementation(({ viewport: bufferingViewport }) =>
          createTreeSpecificVisibilityHandler({
            changeVisibilityStatus: vi.fn(() => {
              bufferingViewport.changeModelDisplay({ modelIds: "0xSECOND", display: true });
              return EMPTY;
            }),
          }),
        );
      using setup = setupTest({
        viewport: vp,
        getTreeSpecificVisibilityHandler,
      });
      const { handler } = setup;

      const nodeA = createNode({ instanceKeys: [{ className: "BisCore.Element", id: "0x1" }] });
      const nodeB = createNode({ instanceKeys: [{ className: "BisCore.Element", id: "0x2" }] });

      // Start first change for nodeA
      const firstPromise = handler.changeVisibility(nodeA, true);

      // Start second change for nodeB — should NOT cancel nodeA
      const secondPromise = handler.changeVisibility(nodeB, true);
      await secondPromise;

      // nodeB's changes are applied, nodeA's are not yet
      expect(vp.changeModelDisplay).toHaveBeenCalledWith({ modelIds: "0xSECOND", display: true });
      expect(vp.changeModelDisplay).not.toHaveBeenCalledWith({ modelIds: "0xFIRST", display: true });

      // Complete nodeA's observable — now its changes are applied too
      firstChangeSubject.complete();
      await firstPromise;

      expect(vp.changeModelDisplay).toHaveBeenCalledWith({ modelIds: "0xFIRST", display: true });
    });

    it("applies changes when same key but different depth completes", async () => {
      const vp = createFakeViewport();
      const firstChangeSubject = new Subject<void>();
      const getTreeSpecificVisibilityHandler = vi
        .fn<HierarchyVisibilityHandlerImplProps<void>["getTreeSpecificVisibilityHandler"]>()
        .mockImplementationOnce(({ viewport: bufferingViewport }) =>
          createTreeSpecificVisibilityHandler({
            changeVisibilityStatus: vi.fn(() => {
              bufferingViewport.changeModelDisplay({ modelIds: "0xDEPTH0", display: true });
              return firstChangeSubject;
            }),
          }),
        )
        .mockImplementation(({ viewport: bufferingViewport }) =>
          createTreeSpecificVisibilityHandler({
            changeVisibilityStatus: vi.fn(() => {
              bufferingViewport.changeModelDisplay({ modelIds: "0xDEPTH1", display: true });
              return EMPTY;
            }),
          }),
        );
      using setup = setupTest({
        viewport: vp,
        getTreeSpecificVisibilityHandler,
      });
      const { handler } = setup;

      const nodeA = createNode({ parentKeys: [] }); // depth 0
      const nodeB = createNode({ parentKeys: [{ type: "instances", instanceKeys: [{ className: "BisCore.Element", id: "0x99" }] }] }); // depth 1

      const firstPromise = handler.changeVisibility(nodeA, true);
      const secondPromise = handler.changeVisibility(nodeB, true);
      await secondPromise;

      // nodeB's changes are applied, nodeA's are not yet
      expect(vp.changeModelDisplay).toHaveBeenCalledWith({ modelIds: "0xDEPTH1", display: true });
      expect(vp.changeModelDisplay).not.toHaveBeenCalledWith({ modelIds: "0xDEPTH0", display: true });

      firstChangeSubject.complete();
      await firstPromise;

      expect(vp.changeModelDisplay).toHaveBeenCalledWith({ modelIds: "0xDEPTH0", display: true });
    });

    it("suppresses and resumes event listeners during change", async () => {
      const changeSubject = new Subject<void>();
      using setup = setupTest({
        visibilityHandler: {
          changeVisibilityStatus: vi.fn(() => changeSubject),
        },
      });
      const { handler, viewport } = setup;
      const spy = vi.fn();
      handler.onVisibilityChange.addListener(spy);

      const changePromise = handler.changeVisibility(createNode(), true);

      // During change, events should be suppressed
      viewport.onDisplayedModelsChanged.raiseEvent();
      await vi.advanceTimersByTimeAsync(0);
      expect(spy).not.toHaveBeenCalled();

      // Complete the change
      changeSubject.complete();
      await changePromise;

      // After change, events should be resumed
      viewport.onDisplayedModelsChanged.raiseEvent();
      await vi.advanceTimersByTimeAsync(0);
      expect(spy).toHaveBeenCalled();
    });
  });

  describe("dispose", () => {
    it("cleans up event listener subscriptions", () => {
      const viewport = createFakeViewport();
      const listenerCountBefore = viewport.onDisplayedModelsChanged.numberOfListeners;

      const handler = new HierarchyVisibilityHandlerImpl<void>({
        viewport,
        getTreeSpecificVisibilityHandler: () => createTreeSpecificVisibilityHandler(),
        getSearchResultsTree: () => undefined,
        cancelChangesInProgress: new Subject<void>(),
        updateChangesInProgress: vi.fn(),
      });

      expect(viewport.onDisplayedModelsChanged.numberOfListeners).toBeGreaterThan(listenerCountBefore);

      handler[Symbol.dispose]();

      expect(viewport.onDisplayedModelsChanged.numberOfListeners).toBe(listenerCountBefore);
    });
  });

  describe("cancelChangesInProgress", () => {
    it("discards buffered changes when cancelChangesInProgress fires during changeVisibility", async () => {
      const vp = createFakeViewport();
      const changeSubject = new Subject<void>();
      using setup = setupTest({
        viewport: vp,
        cancelChangesInProgress: new Subject<void>(),
        updateChangesInProgress: vi.fn(),
        getTreeSpecificVisibilityHandler: ({ viewport: bufferingViewport }) =>
          createTreeSpecificVisibilityHandler({
            changeVisibilityStatus: vi.fn(() => {
              bufferingViewport.changeModelDisplay({ modelIds: "0x1", display: true });
              return changeSubject;
            }),
          }),
      });
      const { handler, cancelChangesInProgress } = setup;

      const changePromise = handler.changeVisibility(createNode(), true);

      // Cancel all ongoing changes — should unsubscribe and discard
      cancelChangesInProgress.next();

      await changePromise;

      // The buffered changes should have been discarded, not committed
      expect(vp.changeModelDisplay).not.toHaveBeenCalled();
    });

    it("does not affect already completed changes", async () => {
      const vp = createFakeViewport();
      using setup = setupTest({
        viewport: vp,
        getTreeSpecificVisibilityHandler: ({ viewport: bufferingViewport }) =>
          createTreeSpecificVisibilityHandler({
            changeVisibilityStatus: vi.fn(() => {
              bufferingViewport.changeModelDisplay({ modelIds: "0x1", display: true });
              return EMPTY;
            }),
          }),
      });
      const { handler, cancelChangesInProgress } = setup;

      // Let change complete normally
      await handler.changeVisibility(createNode(), true);
      expect(vp.changeModelDisplay).toHaveBeenCalledWith({ modelIds: "0x1", display: true });

      // Cancel after completion — should be a no-op
      cancelChangesInProgress.next();
      expect(vp.changeModelDisplay).toHaveBeenCalledTimes(1);
    });

    it("cancels multiple in-flight changes at once", async () => {
      const vp = createFakeViewport();
      const changeSubjectA = new Subject<void>();
      const changeSubjectB = new Subject<void>();
      const getTreeSpecificVisibilityHandler = vi
        .fn<HierarchyVisibilityHandlerImplProps<void>["getTreeSpecificVisibilityHandler"]>()
        .mockImplementationOnce(({ viewport: bufferingViewport }) =>
          createTreeSpecificVisibilityHandler({
            changeVisibilityStatus: vi.fn(() => {
              bufferingViewport.changeModelDisplay({ modelIds: "0xA", display: true });
              return changeSubjectA;
            }),
          }),
        )
        .mockImplementationOnce(({ viewport: bufferingViewport }) =>
          createTreeSpecificVisibilityHandler({
            changeVisibilityStatus: vi.fn(() => {
              bufferingViewport.changeModelDisplay({ modelIds: "0xB", display: false });
              return changeSubjectB;
            }),
          }),
        );
      using setup = setupTest({
        viewport: vp,
        getTreeSpecificVisibilityHandler,
      });
      const { handler, cancelChangesInProgress } = setup;

      const nodeA = createNode({ instanceKeys: [{ className: "BisCore.Element", id: "0x1" }] });
      const nodeB = createNode({ instanceKeys: [{ className: "BisCore.Element", id: "0x2" }] });

      const promiseA = handler.changeVisibility(nodeA, true);
      const promiseB = handler.changeVisibility(nodeB, false);

      // Cancel all
      cancelChangesInProgress.next();

      await promiseA;
      await promiseB;

      // Neither change should have been committed
      expect(vp.changeModelDisplay).not.toHaveBeenCalled();
    });
  });

  describe("updateChangesInProgress", () => {
    it("calls updateChangesInProgress with 'add' when changeVisibility starts", async () => {
      const updateChangesInProgress = vi.fn();
      using setup = setupTest({ updateChangesInProgress });
      const { handler } = setup;

      const changePromise = handler.changeVisibility(createNode(), true);

      expect(updateChangesInProgress).toHaveBeenCalledWith(expect.any(Promise), "add");

      await changePromise;
    });

    it("calls updateChangesInProgress with 'remove' when changeVisibility completes", async () => {
      const updateChangesInProgress = vi.fn();
      using setup = setupTest({ updateChangesInProgress });
      const { handler } = setup;

      await handler.changeVisibility(createNode(), true);

      expect(updateChangesInProgress).toHaveBeenCalledWith(expect.any(Promise), "remove");
      // "add" called first, then "remove"
      expect(updateChangesInProgress).toHaveBeenCalledTimes(2);
      expect(updateChangesInProgress.mock.calls[0][1]).toBe("add");
      expect(updateChangesInProgress.mock.calls[1][1]).toBe("remove");
    });

    it("calls updateChangesInProgress with 'remove' when changeVisibility is cancelled", async () => {
      const updateChangesInProgress = vi.fn();
      const changeSubject = new Subject<void>();
      using setup = setupTest({
        updateChangesInProgress,
        visibilityHandler: {
          changeVisibilityStatus: vi.fn(() => changeSubject),
        },
      });
      const { handler, cancelChangesInProgress } = setup;

      const changePromise = handler.changeVisibility(createNode(), true);
      expect(updateChangesInProgress).toHaveBeenCalledWith(expect.any(Promise), "add");

      // Cancel
      cancelChangesInProgress.next();
      await changePromise;

      expect(updateChangesInProgress).toHaveBeenCalledWith(expect.any(Promise), "remove");
    });

    it("passes the same promise reference to both 'add' and 'remove'", async () => {
      const updateChangesInProgress = vi.fn();
      using setup = setupTest({ updateChangesInProgress });
      const { handler } = setup;

      await handler.changeVisibility(createNode(), true);

      const addedPromise = updateChangesInProgress.mock.calls[0][0];
      const removedPromise = updateChangesInProgress.mock.calls[1][0];
      expect(addedPromise).toBe(removedPromise);
    });
  });
});
