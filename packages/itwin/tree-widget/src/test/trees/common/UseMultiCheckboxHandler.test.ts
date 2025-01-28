/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { act } from "react-dom/test-utils";
import sinon from "sinon";
import { useMultiCheckboxHandler } from "../../../tree-widget/components/trees/common/UseMultiCheckboxHandler.js";
import { renderHook, waitFor } from "../../TestUtils.js";
import { createPresentationHierarchyNode } from "../TreeUtils.js";

import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";

type UseMultiCheckboxHandlerProps = Parameters<typeof useMultiCheckboxHandler>[0];

describe("UseMultiCheckboxHandler", () => {
  const onClickSpy = sinon.stub<[PresentationHierarchyNode, boolean], void>();

  beforeEach(() => {
    onClickSpy.reset();
  });

  it("invokes onClick for single node when it is not selected", async () => {
    const rootNodes = [createPresentationHierarchyNode({ id: "node-1" }), createPresentationHierarchyNode({ id: "node-2" })];
    const isNodeSelected = (nodeId: string) => nodeId === "node-2";

    const { result } = renderHook((props: UseMultiCheckboxHandlerProps) => useMultiCheckboxHandler(props), {
      initialProps: { rootNodes, isNodeSelected, onClick: onClickSpy },
    });

    act(() => {
      result.current.onCheckboxClicked(rootNodes[0], true);
    });

    await waitFor(() => {
      expect(onClickSpy).to.be.calledOnce;
      expect(onClickSpy).to.be.calledWith(rootNodes[0], true);
    });
  });

  it("invokes onClick for single node when it is only selected node", async () => {
    const rootNodes = [createPresentationHierarchyNode({ id: "node-1" }), createPresentationHierarchyNode({ id: "node-2" })];
    const isNodeSelected = (nodeId: string) => nodeId === "node-2";

    const { result } = renderHook((props: UseMultiCheckboxHandlerProps) => useMultiCheckboxHandler(props), {
      initialProps: { rootNodes, isNodeSelected, onClick: onClickSpy },
    });

    act(() => {
      result.current.onCheckboxClicked(rootNodes[1], true);
    });

    await waitFor(() => {
      expect(onClickSpy).to.be.calledOnce;
      expect(onClickSpy).to.be.calledWith(rootNodes[1], true);
    });
  });

  it("invokes onClick for all selected nodes", async () => {
    const rootNodes = [
      createPresentationHierarchyNode({ id: "node-1" }),
      createPresentationHierarchyNode({ id: "node-2" }),
      createPresentationHierarchyNode({ id: "node-3" }),
    ];
    const isNodeSelected = (nodeId: string) => ["node-1", "node-3"].includes(nodeId);

    const { result } = renderHook((props: UseMultiCheckboxHandlerProps) => useMultiCheckboxHandler(props), {
      initialProps: { rootNodes, isNodeSelected, onClick: onClickSpy },
    });

    act(() => {
      result.current.onCheckboxClicked(rootNodes[2], true);
    });

    await waitFor(() => {
      expect(onClickSpy).to.be.calledTwice;
      expect(onClickSpy).to.be.calledWith(rootNodes[0], true);
      expect(onClickSpy).to.be.calledWith(rootNodes[2], true);
    });
  });

  it("invokes onClick for selected child nodes", async () => {
    const childNodes = [createPresentationHierarchyNode({ id: "child-1" }), createPresentationHierarchyNode({ id: "child-2" })];
    const rootNodes = [
      createPresentationHierarchyNode({ id: "node-1" }),
      createPresentationHierarchyNode({ id: "node-2" }),
      createPresentationHierarchyNode({ id: "node-3", children: childNodes, isExpanded: true }),
    ];
    const isNodeSelected = (nodeId: string) => ["node-1", "node-3", "child-2"].includes(nodeId);

    const { result } = renderHook((props: UseMultiCheckboxHandlerProps) => useMultiCheckboxHandler(props), {
      initialProps: { rootNodes, isNodeSelected, onClick: onClickSpy },
    });

    act(() => {
      result.current.onCheckboxClicked(rootNodes[0], true);
    });

    await waitFor(() => {
      expect(onClickSpy).to.be.calledThrice;
      expect(onClickSpy).to.be.calledWith(rootNodes[0], true);
      expect(onClickSpy).to.be.calledWith(rootNodes[2], true);
      expect(onClickSpy).to.be.calledWith(childNodes[1], true);
    });
  });

  it("does not invoke onClick for child nodes if parent is not expanded", async () => {
    const childNodes = [createPresentationHierarchyNode({ id: "child-1" }), createPresentationHierarchyNode({ id: "child-2" })];
    const rootNodes = [
      createPresentationHierarchyNode({ id: "node-1" }),
      createPresentationHierarchyNode({ id: "node-2" }),
      createPresentationHierarchyNode({ id: "node-3", children: childNodes, isExpanded: false }),
    ];
    const isNodeSelected = (nodeId: string) => ["node-1", "node-3", "child-2"].includes(nodeId);

    const { result } = renderHook((props: UseMultiCheckboxHandlerProps) => useMultiCheckboxHandler(props), {
      initialProps: { rootNodes, isNodeSelected, onClick: onClickSpy },
    });

    act(() => {
      result.current.onCheckboxClicked(rootNodes[0], true);
    });

    await waitFor(() => {
      expect(onClickSpy).to.be.calledTwice;
      expect(onClickSpy).to.be.calledWith(rootNodes[0], true);
      expect(onClickSpy).to.be.calledWith(rootNodes[2], true);
    });
  });
});
