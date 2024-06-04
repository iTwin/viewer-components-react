/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { act } from "react-dom/test-utils";
import { createStorage } from "@itwin/unified-selection";
import { useFocusedInstancesContext } from "../../../../components/trees/stateless/common/FocusedInstancesContext";
import { FocusedInstancesContextProvider } from "../../../../components/trees/stateless/common/FocusedInstancesContextProvider";
import { renderHook, waitFor } from "../../../TestUtils";

import type { PropsWithChildren } from "react";

describe("FocusedInstancesContext", () => {
  const selectionStorage = createStorage();
  const imodelKey = "imodelKey";

  beforeEach(() => {
    selectionStorage.clearStorage({ imodelKey });
  });

  it("toggles instances focusing", async () => {
    const { result } = renderHook(useFocusedInstancesContext, {
      wrapper: ({ children }: PropsWithChildren<{}>) => (
        <FocusedInstancesContextProvider selectionStorage={selectionStorage} imodelKey={imodelKey}>
          {children}
        </FocusedInstancesContextProvider>
      ),
    });

    expect(result.current.enabled).to.be.false;
    act(() => {
      result.current.toggle();
    });

    await waitFor(() => {
      expect(result.current.enabled).to.be.true;
    });

    act(() => {
      result.current.toggle();
    });

    await waitFor(() => {
      expect(result.current.enabled).to.be.false;
    });
  });

  it("tracks selected instances", async () => {
    const { result } = renderHook(useFocusedInstancesContext, {
      wrapper: ({ children }: PropsWithChildren<{}>) => (
        <FocusedInstancesContextProvider selectionStorage={selectionStorage} imodelKey={imodelKey}>
          {children}
        </FocusedInstancesContextProvider>
      ),
    });

    act(() => {
      result.current.toggle();
    });

    await waitFor(() => {
      expect(result.current.enabled).to.be.true;
    });

    act(() => {
      selectionStorage.addToSelection({ imodelKey, level: 0, source: "test", selectables: [{ className: "Schema:Class", id: "0x1" }] });
    });

    await waitFor(() => {
      expect(result.current.instanceKeys).to.containSubset([{ className: "Schema:Class", id: "0x1" }]);
    });
  });

  it("ignores unrelated imodel selection changes", async () => {
    const { result } = renderHook(useFocusedInstancesContext, {
      wrapper: ({ children }: PropsWithChildren<{}>) => (
        <FocusedInstancesContextProvider selectionStorage={selectionStorage} imodelKey={imodelKey}>
          {children}
        </FocusedInstancesContextProvider>
      ),
    });

    act(() => {
      result.current.toggle();
    });

    await waitFor(() => {
      expect(result.current.enabled).to.be.true;
    });

    act(() => {
      selectionStorage.addToSelection({ imodelKey: "otherImodel", level: 0, source: "test", selectables: [{ className: "Schema:Class", id: "0x1" }] });
    });

    await waitFor(() => {
      expect(result.current.instanceKeys).to.be.undefined;
    });
  });

  it("listens for selection changes only in root level", async () => {
    const { result } = renderHook(useFocusedInstancesContext, {
      wrapper: ({ children }: PropsWithChildren<{}>) => (
        <FocusedInstancesContextProvider selectionStorage={selectionStorage} imodelKey={imodelKey}>
          {children}
        </FocusedInstancesContextProvider>
      ),
    });

    act(() => {
      result.current.toggle();
    });

    await waitFor(() => {
      expect(result.current.enabled).to.be.true;
    });

    act(() => {
      selectionStorage.addToSelection({ imodelKey, level: 1, source: "test", selectables: [{ className: "Schema:Class", id: "0x1" }] });
    });

    await waitFor(() => {
      expect(result.current.instanceKeys).to.be.undefined;
    });
  });
});
