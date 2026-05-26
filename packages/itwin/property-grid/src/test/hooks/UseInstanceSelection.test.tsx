/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StandardNodeTypes } from "@itwin/presentation-common";
import { Selectables, TRANSIENT_ELEMENT_CLASSNAME } from "@itwin/unified-selection";
import { useInstanceSelection } from "../../property-grid-react/hooks/UseInstanceSelection.js";
import { TelemetryContextProvider } from "../../property-grid-react/hooks/UseTelemetryContext.js";
import { act, createResolvablePromise, renderHook, stubSelectionStorage, waitFor } from "../TestUtils.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { ECInstancesNodeKey, InstanceKey } from "@itwin/presentation-common";
import type { EventArgs } from "@itwin/presentation-shared";
import type { Selectable, SelectableInstanceKey } from "@itwin/unified-selection";

describe("useInstanceSelection", () => {
  const imodel = {
    key: "test-imodel",
  } as IModelConnection;
  const getParentInstanceKeyStub = vi.fn<(key: SelectableInstanceKey) => Promise<SelectableInstanceKey | undefined>>();

  const parentKey: InstanceKey = { id: "0x1", className: "TestSchema.TestClass" };
  const childKey: InstanceKey = { id: "0x2", className: "TestSchema.TestClass" };
  const grandChildKey: InstanceKey = { id: "0x3", className: "TestSchema.TestClass" };
  const noParentKey: InstanceKey = { id: "0x4", className: "TestSchema.TestClass" };

  let selectionStorage: ReturnType<typeof stubSelectionStorage>;

  beforeEach(async () => {
    selectionStorage = stubSelectionStorage();
  });

  beforeEach(async () => {
    getParentInstanceKeyStub.mockImplementation(async ({ id }) => {
      switch (id) {
        case parentKey.id:
          return parentKey;
        case childKey.id:
          return parentKey;
        case grandChildKey.id:
          return childKey;
        case noParentKey.id:
          return noParentKey;
      }
      return undefined;
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("with unified selection storage", () => {
    async function setupSelection(keys: Selectable[]) {
      selectionStorage.getSelection.mockReset();
      selectionStorage.getSelection.mockReturnValue(Selectables.create(keys));
    }
    function triggerSelectionChange(props?: Pick<Partial<EventArgs<typeof selectionStorage.selectionChangeEvent>>, "source">) {
      selectionStorage.selectionChangeEvent.raiseEvent({ source: "TestSource", imodelKey: imodel.key, ...props } as EventArgs<
        typeof selectionStorage.selectionChangeEvent
      >);
    }
    function assertReplaceNotCalled() {
      expect(selectionStorage.replaceSelection).not.toHaveBeenCalled();
    }
    function assertReplaceCalledWithKeys(keys: InstanceKey[]) {
      expect(selectionStorage.replaceSelection).toHaveBeenCalledWith({ source: "Property Grid", imodelKey: imodel.key, selectables: keys, level: 0 });
    }
    function getProps() {
      return { imodel, selectionStorage, getParentInstanceKey: getParentInstanceKeyStub };
    }

    it("returns selected instance keys", async () => {
      const otherKey: InstanceKey = { id: "0x5", className: "OtherSchema.OtherClass" };
      await setupSelection([noParentKey, otherKey]);
      const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

      await waitFor(() => {
        expect(result.current.selectedKeys).toHaveLength(2);
      });
    });

    it("returns instance keys from instance nodes", async () => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const key: ECInstancesNodeKey = {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        type: StandardNodeTypes.ECInstancesNode,
        instanceKeys: [noParentKey],
        pathFromRoot: [],
        version: 2,
      };
      await setupSelection([
        {
          identifier: "instances node key",
          data: key,
          async *loadInstanceKeys() {
            yield noParentKey;
          },
        },
      ]);

      const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

      await waitFor(() => {
        expect(result.current.selectedKeys).toEqual([noParentKey]);
      });
    });

    it("ignores transient instance keys", async () => {
      const transientKey: InstanceKey = { id: "0xffffff0000000001", className: TRANSIENT_ELEMENT_CLASSNAME };
      await setupSelection([noParentKey, transientKey]);
      const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

      await waitFor(() => {
        expect(result.current.selectedKeys).toHaveLength(1);
      });
    });

    it("reacts to selection changes", async () => {
      const otherKey: InstanceKey = { id: "0x5", className: "OtherSchema.OtherClass" };
      await setupSelection([noParentKey]);
      const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

      await waitFor(() => {
        expect(result.current.selectedKeys).toHaveLength(1);
        expect(result.current.selectedKeys[0].id).toBe(noParentKey.id);
      });

      await setupSelection([otherKey]);
      act(() => triggerSelectionChange({ source: "OtherSource" }));

      await waitFor(() => {
        expect(result.current.selectedKeys).toHaveLength(1);
        expect(result.current.selectedKeys[0].id).toBe(otherKey.id);
      });
    });

    it("focuses single instance", async () => {
      const otherKey: InstanceKey = { id: "0x5", className: "OtherSchema.OtherClass" };
      await setupSelection([noParentKey, otherKey]);
      const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

      await waitFor(() => {
        expect(result.current.selectedKeys).toHaveLength(2);
        expect(result.current.focusedInstanceKey).toBeUndefined();
      });

      act(() => result.current.focusInstance(otherKey));

      await waitFor(() => {
        expect(result.current.focusedInstanceKey).toBe(otherKey);
      });
    });

    it("resets focused instance after selection change", async () => {
      const otherKey: InstanceKey = { id: "0x5", className: "OtherSchema.OtherClass" };
      await setupSelection([noParentKey, otherKey]);
      const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

      await waitFor(() => {
        expect(result.current.selectedKeys).toHaveLength(2);
        expect(result.current.focusedInstanceKey).toBeUndefined();
      });

      act(() => result.current.focusInstance(otherKey));

      await waitFor(() => {
        expect(result.current.focusedInstanceKey).toBe(otherKey);
      });

      await setupSelection([otherKey]);
      act(() => triggerSelectionChange({ source: "OtherSource" }));

      await waitFor(() => {
        expect(result.current.selectedKeys).toHaveLength(1);
        expect(result.current.focusedInstanceKey).toBeUndefined();
      });
    });

    describe("ancestors navigation", () => {
      it("can navigate to parent when single instance selected", async () => {
        await setupSelection([childKey]);
        const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

        await waitFor(() => {
          expect(result.current.selectedKeys).toHaveLength(1);
          expect(result.current.ancestorsNavigationProps.canNavigateUp).toBe(true);
        });
      });

      it("can't navigate to parent when multiple instances selected", async () => {
        await setupSelection([childKey, noParentKey]);
        const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

        await waitFor(() => {
          expect(result.current.selectedKeys).toHaveLength(2);
          expect(result.current.ancestorsNavigationProps.canNavigateUp).toBe(false);
        });
      });

      it("navigates to parent", async () => {
        await setupSelection([childKey]);
        const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

        await waitFor(() => {
          expect(result.current.selectedKeys[0].id).toBe(childKey.id);
          expect(result.current.ancestorsNavigationProps.canNavigateUp).toBe(true);
        });

        await act(async () => result.current.ancestorsNavigationProps.navigateUp());

        await waitFor(() => {
          expect(result.current.selectedKeys[0].id).toBe(parentKey.id);
        });

        assertReplaceCalledWithKeys([parentKey]);
      });

      it("navigates down initial instance", async () => {
        await setupSelection([childKey]);
        const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

        await waitFor(() => {
          expect(result.current.selectedKeys[0].id).toBe(childKey.id);
          expect(result.current.ancestorsNavigationProps.canNavigateUp).toBe(true);
        });

        await act(async () => result.current.ancestorsNavigationProps.navigateUp());
        await waitFor(() => {
          expect(result.current.selectedKeys[0].id).toBe(parentKey.id);
          expect(result.current.ancestorsNavigationProps.canNavigateDown).toBe(true);
        });
        assertReplaceCalledWithKeys([parentKey]);

        act(() => result.current.ancestorsNavigationProps.navigateDown());
        await waitFor(() => {
          expect(result.current.selectedKeys[0].id).toBe(childKey.id);
          expect(result.current.ancestorsNavigationProps.canNavigateDown).toBe(false);
        });
        assertReplaceCalledWithKeys([childKey]);
      });

      it("cannot navigate up when instance doesn't have parent", async () => {
        await setupSelection([parentKey]);
        const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

        await waitFor(() => {
          expect(result.current.selectedKeys[0].id).toBe(parentKey.id);
          expect(result.current.ancestorsNavigationProps.canNavigateDown).toBe(false);
        });
      });

      it("does nothing if cannot navigate", async () => {
        await setupSelection([parentKey, childKey]);
        const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

        await waitFor(() => {
          expect(result.current.selectedKeys).toHaveLength(2);
        });

        await act(async () => result.current.ancestorsNavigationProps.navigateUp());
        assertReplaceNotCalled();

        act(() => result.current.ancestorsNavigationProps.navigateDown());
        assertReplaceNotCalled();
      });

      it("cannot navigate up again while navigating", async () => {
        await setupSelection([grandChildKey]);
        const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

        getParentInstanceKeyStub.mockReset();
        getParentInstanceKeyStub.mockResolvedValue(childKey);

        // wait until navigating up is possible
        await waitFor(() => {
          expect(result.current.ancestorsNavigationProps.canNavigateUp).toBe(true);
        });

        const getParentInstanceKeyResult = createResolvablePromise<InstanceKey | undefined>();
        getParentInstanceKeyStub.mockReset();
        getParentInstanceKeyStub.mockReturnValue(getParentInstanceKeyResult.promise);

        // initiate navigation up
        act(() => void result.current.ancestorsNavigationProps.navigateUp());

        // expect navigating up again to be not possible
        await waitFor(() => {
          expect(result.current.ancestorsNavigationProps.canNavigateUp).toBe(false);
        });

        // finish navigating up
        await act(async () => getParentInstanceKeyResult.resolve(childKey));

        // expect navigating up to be possible again
        await waitFor(() => {
          expect(result.current.selectedKeys[0].id).toBe(childKey.id);
          expect(result.current.ancestorsNavigationProps.canNavigateDown).toBe(true);
        });
      });
    });

    it("handles multiple selection changes", async () => {
      await setupSelection([]);
      const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

      await waitFor(() => {
        expect(result.current.selectedKeys).toHaveLength(0);
      });

      getParentInstanceKeyStub.mockReset();
      const getParentInstanceKeyCall1 = createResolvablePromise<InstanceKey | undefined>();
      const getParentInstanceKeyCall2 = createResolvablePromise<InstanceKey | undefined>();

      // simulate first selection change
      await setupSelection([noParentKey]);
      getParentInstanceKeyStub.mockReturnValue(getParentInstanceKeyCall1.promise);
      act(() => triggerSelectionChange({ source: "OtherSource" }));
      assertReplaceNotCalled();

      // simulate second selection change
      await setupSelection([childKey]);
      getParentInstanceKeyStub.mockReturnValue(getParentInstanceKeyCall2.promise);
      act(() => triggerSelectionChange({ source: "OtherSource" }));
      assertReplaceNotCalled();

      // resolve promise for second selection change
      await act(async () => getParentInstanceKeyCall2.resolve(parentKey));

      // make sure state matches result of second selection change
      await waitFor(() => {
        expect(result.current.selectedKeys).toHaveLength(1);
        expect(result.current.selectedKeys[0].id).toBe(childKey.id);
        expect(result.current.ancestorsNavigationProps.canNavigateUp).toBe(true);
      });

      // resolve promise for first selection change
      await act(async () => getParentInstanceKeyCall1.resolve(undefined));

      // make sure state still matches result of second selection change
      await waitFor(() => {
        expect(result.current.selectedKeys).toHaveLength(1);
        expect(result.current.selectedKeys[0].id).toBe(childKey.id);
        expect(result.current.ancestorsNavigationProps.canNavigateUp).toBe(true);
      });
    });
  });

  describe("feature usage reporting", () => {
    it("reports when navigates up and down", async () => {
      const onFeatureUsedSpy = vi.fn();
      selectionStorage.getSelection.mockReturnValue(Selectables.create([childKey]));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TelemetryContextProvider onFeatureUsed={onFeatureUsedSpy}>{children}</TelemetryContextProvider>
      );
      const { result } = renderHook(useInstanceSelection, {
        initialProps: { imodel, selectionStorage, getParentInstanceKey: getParentInstanceKeyStub },
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.selectedKeys[0].id).toBe(childKey.id);
        expect(result.current.ancestorsNavigationProps.canNavigateUp).toBe(true);
      });

      await act(async () => result.current.ancestorsNavigationProps.navigateUp());

      await waitFor(() => {
        expect(result.current.selectedKeys[0].id).toBe(parentKey.id);
        expect(result.current.ancestorsNavigationProps.canNavigateDown).toBe(true);
      });

      expect(onFeatureUsedSpy).toHaveBeenCalledExactlyOnceWith("ancestor-navigation");
      onFeatureUsedSpy.mockClear();

      act(() => result.current.ancestorsNavigationProps.navigateDown());

      await waitFor(() => {
        expect(result.current.selectedKeys[0].id).toBe(childKey.id);
        expect(result.current.ancestorsNavigationProps.canNavigateDown).toBe(false);
      });

      expect(onFeatureUsedSpy).toHaveBeenCalledExactlyOnceWith("ancestor-navigation");
    });
  });
});
