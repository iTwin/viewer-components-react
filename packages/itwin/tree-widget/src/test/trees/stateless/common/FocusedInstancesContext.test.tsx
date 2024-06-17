/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { createStorage } from "@itwin/unified-selection";
import { useFocusedInstancesContext } from "../../../../components/trees/stateless/common/FocusedInstancesContext";
import { FocusedInstancesContextProvider } from "../../../../components/trees/stateless/common/FocusedInstancesContextProvider";
import { act, createAsyncIterator, renderHook, waitFor } from "../../../TestUtils";
import { createClassGroupingHierarchyNode } from "../Common";

import type { PropsWithChildren } from "react";
async function collectKeys<T>(loader?: () => AsyncIterableIterator<T>): Promise<T[]> {
  const items: T[] = [];
  if (!loader) {
    return items;
  }

  for await (const item of loader()) {
    items.push(item);
  }
  return items;
}

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

    await waitFor(async () => {
      const instanceKeys = await collectKeys(result.current.loadInstanceKeys);
      expect(instanceKeys).to.containSubset([{ className: "Schema:Class", id: "0x1" }]);
    });
  });

  it("tracks selected grouping nodes", async () => {
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

    const node = createClassGroupingHierarchyNode({ modelId: "0x1", categoryId: "0x2", elements: [] });

    await waitFor(() => {
      expect(result.current.enabled).to.be.true;
    });

    act(() => {
      selectionStorage.addToSelection({
        imodelKey,
        level: 0,
        source: "test",
        selectables: [{ identifier: "node-id", data: node, loadInstanceKeys: () => createAsyncIterator([]) }],
      });
    });

    await waitFor(async () => {
      const instanceKeys = await collectKeys(result.current.loadInstanceKeys);
      expect(instanceKeys).to.containSubset([node]);
    });
  });

  it("tracks custom selectable instance keys", async () => {
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
      selectionStorage.addToSelection({
        imodelKey,
        level: 0,
        source: "test",
        selectables: [
          {
            identifier: "custom-selectable",
            data: undefined,
            loadInstanceKeys: () =>
              createAsyncIterator([
                { id: "0x1", className: "Schema:Class" },
                { id: "0x1", className: "Schema:Class" },
              ]),
          },
        ],
      });
    });

    await waitFor(async () => {
      const instanceKeys = await collectKeys(result.current.loadInstanceKeys);
      expect(instanceKeys).to.containSubset([
        { id: "0x1", className: "Schema:Class" },
        { id: "0x1", className: "Schema:Class" },
      ]);
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
      expect(result.current.loadInstanceKeys).to.be.undefined;
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
      expect(result.current.loadInstanceKeys).to.be.undefined;
    });
  });
});
