/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { KeySet } from "@itwin/presentation-common";
import { waitFor } from "@testing-library/react";
import { renderHook } from "@testing-library/react-hooks";
import { useInstanceSelection } from "../../hooks/UseInstanceSelection";

import type { IModelConnection } from "@itwin/core-frontend";
import type { ISelectionProvider , SelectionChangeEventArgs  } from "@itwin/presentation-frontend";
import type { InstanceKey } from "@itwin/presentation-common";
import type { InstanceSelectionProps } from "../../hooks/UseInstanceSelection";
import { stubSelectionManager } from "../TestUtils";

describe("useInstanceSelection", () => {
  const imodel = {} as IModelConnection;

  const parentKey: InstanceKey = { id: "0x1", className: "ParentClass" };
  const childKey: InstanceKey = { id: "0x2", className: "ChildClass" };
  const grandChildKey: InstanceKey = { id: "0x3", className: "GranChildClass" };
  const noParentKey: InstanceKey = { id: "0x4", className: "NoParentElementClass" };

  let selectionManager: ReturnType<typeof stubSelectionManager>;

  before(() => {
    selectionManager = stubSelectionManager();
    selectionManager.scopes.computeSelection.callsFake(async (_, ids, ) => {
      if (typeof ids !== "string") {
        return new KeySet();
      }

      switch (ids) {
        case parentKey.id: return new KeySet([parentKey]);
        case childKey.id: return new KeySet([parentKey]);
        case grandChildKey.id: return new KeySet([childKey]);
        case noParentKey.id: return new KeySet([noParentKey]);
      }

      return new KeySet();
    });
  });

  beforeEach(() => {
    selectionManager.getSelection.reset();
    selectionManager.replaceSelection.reset();
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

    result.current.focusInstance(otherKey);
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

    result.current.focusInstance(otherKey);
    await waitFor(() => {
      expect(result.current.focusedInstanceKey).to.be.eq(otherKey);
    });

    selectionManager.getSelection.returns(new KeySet([otherKey]));
    selectionManager.selectionChange.raiseEvent({ source: "OtherSource" } as unknown as SelectionChangeEventArgs, {} as ISelectionProvider);

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

      await result.current.ancestorsNavigationProps.navigateUp();

      await waitFor(() => {
        expect(result.current.selectedKeys[0].id).to.be.eq(parentKey.id);
      });

      expect(selectionManager.replaceSelection).to.be.calledOnceWith("Property Grid", imodel, sinon.match((keys: KeySet) => keys.has(parentKey)));
    });

    it("navigates down initial instance", async () => {
      selectionManager.getSelection.returns(new KeySet([childKey]));
      const { result } = renderHook(useInstanceSelection, { initialProps });

      await waitFor(() => {
        expect(result.current.selectedKeys[0].id).to.be.eq(childKey.id);
        expect(result.current.ancestorsNavigationProps.canNavigateUp).to.be.true;
      });

      await result.current.ancestorsNavigationProps.navigateUp();

      await waitFor(() => {
        expect(result.current.selectedKeys[0].id).to.be.eq(parentKey.id);
        expect(result.current.ancestorsNavigationProps.canNavigateDown).to.be.true;
      });

      expect(selectionManager.replaceSelection).to.be.calledOnceWith("Property Grid", imodel, sinon.match((keys: KeySet) => keys.has(parentKey)));
      selectionManager.replaceSelection.resetHistory();

      await result.current.ancestorsNavigationProps.navigateDown();
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

      await result.current.ancestorsNavigationProps.navigateUp();
      expect(selectionManager.replaceSelection).to.not.be.called;

      await result.current.ancestorsNavigationProps.navigateDown();
      expect(selectionManager.replaceSelection).to.not.be.called;
    });
  });
});
