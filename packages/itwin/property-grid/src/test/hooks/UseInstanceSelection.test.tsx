/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { KeySet, StandardNodeTypes } from "@itwin/presentation-common";
import { Selectables, TRANSIENT_ELEMENT_CLASSNAME } from "@itwin/unified-selection";
import { useInstanceSelection } from "../../property-grid-react/hooks/UseInstanceSelection.js";
import { TelemetryContextProvider } from "../../property-grid-react/hooks/UseTelemetryContext.js";
import { createKeysFromSelectable } from "../../property-grid-react/hooks/UseUnifiedSelectionHandler.js";
import { act, createResolvablePromise, renderHook, stubSelectionManager, stubSelectionStorage, waitFor } from "../TestUtils.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { ECInstancesNodeKey, InstanceKey } from "@itwin/presentation-common";
import type { ISelectionProvider } from "@itwin/presentation-frontend";
import type { EventArgs } from "@itwin/presentation-shared";
import type { Selectable, SelectableInstanceKey } from "@itwin/unified-selection";

describe("useInstanceSelection", () => {
  const imodel = {
    key: "test-imodel",
  } as IModelConnection;
  const getParentInstanceKeyStub = sinon.stub<[SelectableInstanceKey], Promise<SelectableInstanceKey | undefined>>();

  const parentKey: InstanceKey = { id: "0x1", className: "TestSchema.TestClass" };
  const childKey: InstanceKey = { id: "0x2", className: "TestSchema.TestClass" };
  const grandChildKey: InstanceKey = { id: "0x3", className: "TestSchema.TestClass" };
  const noParentKey: InstanceKey = { id: "0x4", className: "TestSchema.TestClass" };

  let selectionManager: ReturnType<typeof stubSelectionManager>;
  let selectionStorage: ReturnType<typeof stubSelectionStorage>;

  before(async () => {
    selectionManager = stubSelectionManager();
    selectionStorage = stubSelectionStorage();
  });

  after(() => {
    sinon.restore();
  });

  beforeEach(async () => {
    getParentInstanceKeyStub.callsFake(async ({ id }) => {
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
    sinon.reset();
  });

  [
    {
      name: "with unified selection storage",
      getProps: () => ({ imodel, selectionStorage, getParentInstanceKey: getParentInstanceKeyStub }),
      async setupSelection(keys: Selectable[]) {
        selectionStorage.getSelection.reset();
        selectionStorage.getSelection.returns(Selectables.create(keys));
      },
      triggerSelectionChange(props?: Pick<Partial<EventArgs<typeof selectionStorage.selectionChangeEvent>>, "source">) {
        selectionStorage.selectionChangeEvent.raiseEvent({ source: "TestSource", imodelKey: imodel.key, ...props } as EventArgs<
          typeof selectionStorage.selectionChangeEvent
        >);
      },
      assertReplaceNotCalled() {
        expect(selectionStorage.replaceSelection).to.not.be.called;
      },
      assertReplaceCalledWithKeys(keys: InstanceKey[]) {
        expect(selectionStorage.replaceSelection).to.be.calledWith({ source: "Property Grid", imodelKey: imodel.key, selectables: keys, level: 0 });
      },
    },
    {
      name: "with deprecated selection manager",
      getProps: () => ({ imodel, getParentInstanceKey: getParentInstanceKeyStub }),
      async setupSelection(keys: Selectable[]) {
        selectionManager.getSelection.reset();
        selectionManager.getSelection.returns(new KeySet((await Promise.all(keys.map(createKeysFromSelectable))).flat()));
      },
      triggerSelectionChange(props?: Pick<Partial<EventArgs<typeof selectionStorage.selectionChangeEvent>>, "source">) {
        selectionManager.selectionChange.raiseEvent(
          { source: "TestSource", imodel, ...props } as EventArgs<typeof selectionManager.selectionChange>,
          // eslint-disable-next-line deprecation/deprecation
          selectionManager as ISelectionProvider,
        );
      },
      assertReplaceNotCalled() {
        expect(selectionManager.replaceSelection).to.not.be.called;
      },
      assertReplaceCalledWithKeys(keys: InstanceKey[]) {
        expect(selectionManager.replaceSelection).to.be.calledWith("Property Grid", imodel, keys);
      },
    },
  ].forEach(({ name, getProps, setupSelection, triggerSelectionChange, assertReplaceNotCalled, assertReplaceCalledWithKeys }) => {
    describe(name, () => {
      it("returns selected instance keys", async () => {
        const otherKey: InstanceKey = { id: "0x5", className: "OtherSchema.OtherClass" };
        await setupSelection([noParentKey, otherKey]);
        const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

        await waitFor(() => {
          expect(result.current.selectedKeys).to.have.lengthOf(2);
        });
      });

      it("returns instance keys from instance nodes", async () => {
        const key: ECInstancesNodeKey = {
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
          expect(result.current.selectedKeys).to.deep.eq([noParentKey]);
        });
      });

      it("ignores transient instance keys", async () => {
        const transientKey: InstanceKey = { id: "0xffffff0000000001", className: TRANSIENT_ELEMENT_CLASSNAME };
        await setupSelection([noParentKey, transientKey]);
        const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

        await waitFor(() => {
          expect(result.current.selectedKeys).to.have.lengthOf(1);
        });
      });

      it("reacts to selection changes", async () => {
        const otherKey: InstanceKey = { id: "0x5", className: "OtherSchema.OtherClass" };
        await setupSelection([noParentKey]);
        const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

        await waitFor(() => {
          expect(result.current.selectedKeys).to.have.lengthOf(1);
          expect(result.current.selectedKeys[0].id).to.be.eq(noParentKey.id);
        });

        await setupSelection([otherKey]);
        act(() => triggerSelectionChange({ source: "OtherSource" }));

        await waitFor(() => {
          expect(result.current.selectedKeys).to.have.lengthOf(1);
          expect(result.current.selectedKeys[0].id).to.be.eq(otherKey.id);
        });
      });

      it("focuses single instance", async () => {
        const otherKey: InstanceKey = { id: "0x5", className: "OtherSchema.OtherClass" };
        await setupSelection([noParentKey, otherKey]);
        const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

        await waitFor(() => {
          expect(result.current.selectedKeys).to.have.lengthOf(2);
          expect(result.current.focusedInstanceKey).to.be.undefined;
        });

        act(() => result.current.focusInstance(otherKey));

        await waitFor(() => {
          expect(result.current.focusedInstanceKey).to.be.eq(otherKey);
        });
      });

      it("resets focused instance after selection change", async () => {
        const otherKey: InstanceKey = { id: "0x5", className: "OtherSchema.OtherClass" };
        await setupSelection([noParentKey, otherKey]);
        const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

        await waitFor(() => {
          expect(result.current.selectedKeys).to.have.lengthOf(2);
          expect(result.current.focusedInstanceKey).to.be.undefined;
        });

        act(() => result.current.focusInstance(otherKey));

        await waitFor(() => {
          expect(result.current.focusedInstanceKey).to.be.eq(otherKey);
        });

        await setupSelection([otherKey]);
        act(() => triggerSelectionChange({ source: "OtherSource" }));

        await waitFor(() => {
          expect(result.current.selectedKeys).to.have.lengthOf(1);
          expect(result.current.focusedInstanceKey).to.be.undefined;
        });
      });

      describe("ancestors navigation", () => {
        it("can navigate to parent when single instance selected", async () => {
          await setupSelection([childKey]);
          const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

          await waitFor(() => {
            expect(result.current.selectedKeys).to.have.lengthOf(1);
            expect(result.current.ancestorsNavigationProps.canNavigateUp).to.be.true;
          });
        });

        it("can't navigate to parent when multiple instances selected", async () => {
          await setupSelection([childKey, noParentKey]);
          const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

          await waitFor(() => {
            expect(result.current.selectedKeys).to.have.lengthOf(2);
            expect(result.current.ancestorsNavigationProps.canNavigateUp).to.be.false;
          });
        });

        it("navigates to parent", async () => {
          await setupSelection([childKey]);
          const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

          await waitFor(() => {
            expect(result.current.selectedKeys[0].id).to.be.eq(childKey.id);
            expect(result.current.ancestorsNavigationProps.canNavigateUp).to.be.true;
          });

          await act(async () => result.current.ancestorsNavigationProps.navigateUp());

          await waitFor(() => {
            expect(result.current.selectedKeys[0].id).to.be.eq(parentKey.id);
          });

          assertReplaceCalledWithKeys([parentKey]);
        });

        it("navigates down initial instance", async () => {
          await setupSelection([childKey]);
          const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

          await waitFor(() => {
            expect(result.current.selectedKeys[0].id).to.be.eq(childKey.id);
            expect(result.current.ancestorsNavigationProps.canNavigateUp).to.be.true;
          });

          await act(async () => result.current.ancestorsNavigationProps.navigateUp());
          await waitFor(() => {
            expect(result.current.selectedKeys[0].id).to.be.eq(parentKey.id);
            expect(result.current.ancestorsNavigationProps.canNavigateDown).to.be.true;
          });
          assertReplaceCalledWithKeys([parentKey]);

          act(() => result.current.ancestorsNavigationProps.navigateDown());
          await waitFor(() => {
            expect(result.current.selectedKeys[0].id).to.be.eq(childKey.id);
            expect(result.current.ancestorsNavigationProps.canNavigateDown).to.be.false;
          });
          assertReplaceCalledWithKeys([childKey]);
        });

        it("cannot navigate up when instance doesn't have parent", async () => {
          await setupSelection([parentKey]);
          const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

          await waitFor(() => {
            expect(result.current.selectedKeys[0].id).to.be.eq(parentKey.id);
            expect(result.current.ancestorsNavigationProps.canNavigateDown).to.be.false;
          });
        });

        it("does nothing if cannot navigate", async () => {
          await setupSelection([parentKey, childKey]);
          const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

          await waitFor(() => {
            expect(result.current.selectedKeys).to.have.lengthOf(2);
          });

          await act(async () => result.current.ancestorsNavigationProps.navigateUp());
          assertReplaceNotCalled();

          act(() => result.current.ancestorsNavigationProps.navigateDown());
          assertReplaceNotCalled();
        });

        it("cannot navigate up again while navigating", async () => {
          await setupSelection([grandChildKey]);
          const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

          getParentInstanceKeyStub.reset();
          getParentInstanceKeyStub.resolves(childKey);

          // wait until navigating up is possible
          await waitFor(() => {
            expect(result.current.ancestorsNavigationProps.canNavigateUp).to.be.true;
          });

          const getParentInstanceKeyResult = createResolvablePromise<InstanceKey | undefined>();
          getParentInstanceKeyStub.reset();
          getParentInstanceKeyStub.returns(getParentInstanceKeyResult.promise);

          // initiate navigation up
          act(() => void result.current.ancestorsNavigationProps.navigateUp());

          // expect navigating up again to be not possible
          await waitFor(() => {
            expect(result.current.ancestorsNavigationProps.canNavigateUp).to.be.false;
          });

          // finish navigating up
          await act(async () => getParentInstanceKeyResult.resolve(childKey));

          // expect navigating up to be possible again
          await waitFor(() => {
            expect(result.current.selectedKeys[0].id).to.be.eq(childKey.id);
            expect(result.current.ancestorsNavigationProps.canNavigateDown).to.be.true;
          });
        });
      });

      it("handles multiple selection changes", async () => {
        await setupSelection([]);
        const { result } = renderHook(useInstanceSelection, { initialProps: getProps() });

        await waitFor(() => {
          expect(result.current.selectedKeys).to.have.lengthOf(0);
        });

        getParentInstanceKeyStub.reset();
        const getParentInstanceKeyCall1 = createResolvablePromise<InstanceKey | undefined>();
        const getParentInstanceKeyCall2 = createResolvablePromise<InstanceKey | undefined>();

        // simulate first selection change
        await setupSelection([noParentKey]);
        getParentInstanceKeyStub.returns(getParentInstanceKeyCall1.promise);
        act(() => triggerSelectionChange({ source: "OtherSource" }));
        assertReplaceNotCalled();

        // simulate second selection change
        await setupSelection([childKey]);
        getParentInstanceKeyStub.returns(getParentInstanceKeyCall2.promise);
        act(() => triggerSelectionChange({ source: "OtherSource" }));
        assertReplaceNotCalled();

        // resolve promise for second selection change
        await act(async () => getParentInstanceKeyCall2.resolve(parentKey));

        // make sure state matches result of second selection change
        await waitFor(() => {
          expect(result.current.selectedKeys).to.have.lengthOf(1);
          expect(result.current.selectedKeys[0].id).to.be.eq(childKey.id);
          expect(result.current.ancestorsNavigationProps.canNavigateUp).to.be.true;
        });

        // resolve promise for first selection change
        await act(async () => getParentInstanceKeyCall1.resolve(undefined));

        // make sure state still matches result of second selection change
        await waitFor(() => {
          expect(result.current.selectedKeys).to.have.lengthOf(1);
          expect(result.current.selectedKeys[0].id).to.be.eq(childKey.id);
          expect(result.current.ancestorsNavigationProps.canNavigateUp).to.be.true;
        });
      });
    });
  });

  describe("feature usage reporting", () => {
    it("reports when navigates up and down", async () => {
      const onFeatureUsedSpy = sinon.spy();
      selectionStorage.getSelection.returns(Selectables.create([childKey]));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TelemetryContextProvider onFeatureUsed={onFeatureUsedSpy}>{children}</TelemetryContextProvider>
      );
      const { result } = renderHook(useInstanceSelection, {
        initialProps: { imodel, selectionStorage, getParentInstanceKey: getParentInstanceKeyStub },
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.selectedKeys[0].id).to.be.eq(childKey.id);
        expect(result.current.ancestorsNavigationProps.canNavigateUp).to.be.true;
      });

      await act(async () => result.current.ancestorsNavigationProps.navigateUp());

      await waitFor(() => {
        expect(result.current.selectedKeys[0].id).to.be.eq(parentKey.id);
        expect(result.current.ancestorsNavigationProps.canNavigateDown).to.be.true;
      });

      expect(onFeatureUsedSpy).to.be.calledOnceWith("ancestor-navigation");
      onFeatureUsedSpy.resetHistory();

      act(() => result.current.ancestorsNavigationProps.navigateDown());

      await waitFor(() => {
        expect(result.current.selectedKeys[0].id).to.be.eq(childKey.id);
        expect(result.current.ancestorsNavigationProps.canNavigateDown).to.be.false;
      });

      expect(onFeatureUsedSpy).to.be.calledOnceWith("ancestor-navigation");
    });
  });
});
