/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { KeySet } from "@itwin/presentation-common";
import { useInstanceSelection } from "../../hooks/UseInstanceSelection";
import { act, createResolvablePromise, renderHook, stubSelectionManager, waitFor } from "../TestUtils";

import type { IModelConnection } from "@itwin/core-frontend";
import type { ISelectionProvider, SelectionChangeEventArgs } from "@itwin/presentation-frontend";
import type { InstanceKey } from "@itwin/presentation-common";
import type { InstanceSelectionProps } from "../../hooks/UseInstanceSelection";

describe("useInstanceSelection", () => {
  const imodel = {} as IModelConnection;

  const parentKey: InstanceKey = { id: "0x1", className: "TestClass" };
  const childKey: InstanceKey = { id: "0x2", className: "TestClass" };
  const grandChildKey: InstanceKey = { id: "0x3", className: "TestClass" };
  const noParentKey: InstanceKey = { id: "0x4", className: "TestClass" };

  let selectionManager: ReturnType<typeof stubSelectionManager>;

  before(() => {
    selectionManager = stubSelectionManager();
  });

  beforeEach(() => {
    selectionManager.getSelection.reset();
    selectionManager.replaceSelection.reset();
    selectionManager.scopes.computeSelection.reset();
    selectionManager.scopes.computeSelection.callsFake(async (_, ids) => {
      if (typeof ids !== "string") {
        return new KeySet();
      }

      switch (ids) {
        case parentKey.id:
          return new KeySet([parentKey]);
        case childKey.id:
          return new KeySet([parentKey]);
        case grandChildKey.id:
          return new KeySet([childKey]);
        case noParentKey.id:
          return new KeySet([noParentKey]);
      }

      return new KeySet();
    });
  });

  it("returns selected instance keys", async () => {
    const otherKey: InstanceKey = { id: "0x5", className: "OtherClass" };
    selectionManager.getSelection.returns(new KeySet([noParentKey, otherKey]));
    const { result } = renderHook(useInstanceSelection, { initialProps: { imodel } });

    await waitFor(() => {
      expect(result.current.selectedKeys).to.have.lengthOf(2);
    });
  });

  it("ignores transient instance keys", async () => {
    const transientKey: InstanceKey = { id: "0xffffff0000000001", className: "Transient" };
    selectionManager.getSelection.returns(new KeySet([noParentKey, transientKey]));
    const { result } = renderHook(useInstanceSelection, { initialProps: { imodel } });

    await waitFor(() => {
      expect(result.current.selectedKeys).to.have.lengthOf(1);
    });
  });

  it("reacts to selection changes", async () => {
    const otherKey: InstanceKey = { id: "0x5", className: "OtherClass" };
    selectionManager.getSelection.returns(new KeySet([noParentKey]));
    const { result } = renderHook(useInstanceSelection, { initialProps: { imodel } });

    await waitFor(() => {
      expect(result.current.selectedKeys).to.have.lengthOf(1);
      expect(result.current.selectedKeys[0].id).to.be.eq(noParentKey.id);
    });

    selectionManager.getSelection.returns(new KeySet([otherKey]));
    selectionManager.selectionChange.raiseEvent({ source: "OtherSource" } as unknown as SelectionChangeEventArgs, {} as ISelectionProvider);

    await waitFor(() => {
      expect(result.current.selectedKeys).to.have.lengthOf(1);
      expect(result.current.selectedKeys[0].id).to.be.eq(otherKey.id);
    });
  });

  it("focuses single instance", async () => {
    const otherKey: InstanceKey = { id: "0x5", className: "OtherClass" };
    selectionManager.getSelection.returns(new KeySet([noParentKey, otherKey]));
    const { result } = renderHook(useInstanceSelection, { initialProps: { imodel } });

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
    const otherKey: InstanceKey = { id: "0x5", className: "OtherClass" };
    selectionManager.getSelection.returns(new KeySet([noParentKey, otherKey]));
    const { result } = renderHook(useInstanceSelection, { initialProps: { imodel } });

    await waitFor(() => {
      expect(result.current.selectedKeys).to.have.lengthOf(2);
      expect(result.current.focusedInstanceKey).to.be.undefined;
    });

    act(() => result.current.focusInstance(otherKey));

    await waitFor(() => {
      expect(result.current.focusedInstanceKey).to.be.eq(otherKey);
    });

    selectionManager.getSelection.returns(new KeySet([otherKey]));
    act(() => selectionManager.selectionChange.raiseEvent({ source: "OtherSource" } as unknown as SelectionChangeEventArgs, {} as ISelectionProvider));

    await waitFor(() => {
      expect(result.current.selectedKeys).to.have.lengthOf(1);
      expect(result.current.focusedInstanceKey).to.be.undefined;
    });
  });

  describe("ancestors navigation", () => {
    const initialProps: InstanceSelectionProps = {
      imodel,
    };

    it("can navigate to parent when single instance selected", async () => {
      selectionManager.getSelection.returns(new KeySet([childKey]));
      const { result } = renderHook(useInstanceSelection, { initialProps });

      await waitFor(() => {
        expect(result.current.selectedKeys).to.have.lengthOf(1);
        expect(result.current.ancestorsNavigationProps.canNavigateUp).to.be.true;
      });
    });

    it("can't navigate to parent when multiple instances selected", async () => {
      selectionManager.getSelection.returns(new KeySet([childKey, noParentKey]));
      const { result } = renderHook(useInstanceSelection, { initialProps });

      await waitFor(() => {
        expect(result.current.selectedKeys).to.have.lengthOf(2);
        expect(result.current.ancestorsNavigationProps.canNavigateUp).to.be.false;
      });
    });

    it("navigates to parent", async () => {
      selectionManager.getSelection.returns(new KeySet([childKey]));
      const { result } = renderHook(useInstanceSelection, { initialProps });

      await waitFor(() => {
        expect(result.current.selectedKeys[0].id).to.be.eq(childKey.id);
        expect(result.current.ancestorsNavigationProps.canNavigateUp).to.be.true;
      });

      await act(async () => result.current.ancestorsNavigationProps.navigateUp());

      await waitFor(() => {
        expect(result.current.selectedKeys[0].id).to.be.eq(parentKey.id);
      });

      expect(selectionManager.replaceSelection).to.be.calledOnceWith(
        "Property Grid",
        imodel,
        sinon.match((keys: KeySet) => keys.has(parentKey)),
      );
    });

    it("navigates down initial instance", async () => {
      selectionManager.getSelection.returns(new KeySet([childKey]));
      const { result } = renderHook(useInstanceSelection, { initialProps });

      await waitFor(() => {
        expect(result.current.selectedKeys[0].id).to.be.eq(childKey.id);
        expect(result.current.ancestorsNavigationProps.canNavigateUp).to.be.true;
      });

      await act(async () => result.current.ancestorsNavigationProps.navigateUp());

      await waitFor(() => {
        expect(result.current.selectedKeys[0].id).to.be.eq(parentKey.id);
        expect(result.current.ancestorsNavigationProps.canNavigateDown).to.be.true;
      });

      expect(selectionManager.replaceSelection).to.be.calledOnceWith(
        "Property Grid",
        imodel,
        sinon.match((keys: KeySet) => keys.has(parentKey)),
      );
      selectionManager.replaceSelection.resetHistory();

      act(() => result.current.ancestorsNavigationProps.navigateDown());

      await waitFor(() => {
        expect(result.current.selectedKeys[0].id).to.be.eq(childKey.id);
        expect(result.current.ancestorsNavigationProps.canNavigateDown).to.be.false;
      });

      expect(selectionManager.replaceSelection).to.be.calledOnceWith("Property Grid", imodel, [childKey]);
    });

    it("cannot navigate up when instance doesn't have parent", async () => {
      selectionManager.getSelection.returns(new KeySet([parentKey]));
      const { result } = renderHook(useInstanceSelection, { initialProps });

      await waitFor(() => {
        expect(result.current.selectedKeys[0].id).to.be.eq(parentKey.id);
        expect(result.current.ancestorsNavigationProps.canNavigateDown).to.be.false;
      });
    });

    it("does nothing if cannot navigate", async () => {
      selectionManager.getSelection.returns(new KeySet([parentKey, childKey]));
      const { result } = renderHook(useInstanceSelection, { initialProps: { ...initialProps } });

      await waitFor(() => {
        expect(result.current.selectedKeys).to.have.lengthOf(2);
      });

      await act(async () => result.current.ancestorsNavigationProps.navigateUp());
      expect(selectionManager.replaceSelection).to.not.be.called;

      act(() => result.current.ancestorsNavigationProps.navigateDown());
      expect(selectionManager.replaceSelection).to.not.be.called;
    });

    it("cannot navigate up again while navigating", async () => {
      selectionManager.getSelection.returns(new KeySet([grandChildKey]));
      const { result } = renderHook(useInstanceSelection, { initialProps });

      selectionManager.scopes.computeSelection.reset();
      const computeSelection = createResolvablePromise<KeySet>();
      selectionManager.scopes.computeSelection.returns(computeSelection.promise);

      // wait until navigating up is possible
      await waitFor(() => {
        expect(result.current.ancestorsNavigationProps.canNavigateUp).to.be.true;
      });

      // initiate navigation up
      act(() => void result.current.ancestorsNavigationProps.navigateUp());

      // expect navigating up again to be not possible
      await waitFor(() => {
        expect(result.current.ancestorsNavigationProps.canNavigateUp).to.be.false;
      });

      // finish navigating up
      await act(async () => computeSelection.resolve(new KeySet([childKey])));

      // expect navigating up to be possible again
      await waitFor(() => {
        expect(result.current.selectedKeys[0].id).to.be.eq(childKey.id);
        expect(result.current.ancestorsNavigationProps.canNavigateDown).to.be.true;
      });
    });
  });

  it("handles multiple selection changes", async () => {
    selectionManager.getSelection.returns(new KeySet([]));
    const { result } = renderHook(useInstanceSelection, { initialProps: { imodel } });

    await waitFor(() => {
      expect(result.current.selectedKeys).to.have.lengthOf(0);
    });

    selectionManager.scopes.computeSelection.reset();
    const firstComputeSelection = createResolvablePromise<KeySet>();
    const secondComputeSelection = createResolvablePromise<KeySet>();

    // simulate first selection change
    selectionManager.getSelection.returns(new KeySet([noParentKey]));
    selectionManager.scopes.computeSelection.returns(firstComputeSelection.promise);
    act(() => selectionManager.selectionChange.raiseEvent({ source: "OtherSource" } as unknown as SelectionChangeEventArgs, {} as ISelectionProvider));

    // simulate second selection change
    selectionManager.getSelection.returns(new KeySet([childKey]));
    selectionManager.scopes.computeSelection.returns(secondComputeSelection.promise);
    act(() => selectionManager.selectionChange.raiseEvent({ source: "OtherSource" } as unknown as SelectionChangeEventArgs, {} as ISelectionProvider));

    // resolve promise for second selection change
    await act(async () => secondComputeSelection.resolve(new KeySet([parentKey])));

    // make sure state matches result of second selection change
    await waitFor(() => {
      expect(result.current.selectedKeys).to.have.lengthOf(1);
      expect(result.current.selectedKeys[0].id).to.be.eq(childKey.id);
      expect(result.current.ancestorsNavigationProps.canNavigateUp).to.be.true;
    });

    // resolve promise for first selection change
    await act(async () => firstComputeSelection.resolve(new KeySet()));

    // make sure state still matches result of second selection change
    await waitFor(() => {
      expect(result.current.selectedKeys).to.have.lengthOf(1);
      expect(result.current.selectedKeys[0].id).to.be.eq(childKey.id);
      expect(result.current.ancestorsNavigationProps.canNavigateUp).to.be.true;
    });
  });
});
