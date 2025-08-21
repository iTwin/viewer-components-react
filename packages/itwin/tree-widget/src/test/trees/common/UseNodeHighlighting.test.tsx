/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { useNodeHighlighting } from "../../../tree-widget-react/components/trees/common/UseNodeHighlighting.js";
import { render, renderHook } from "../../TestUtils.js";
import { createPresentationHierarchyNode } from "../TreeUtils.js";

import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";

describe("useNodeHighlighting", () => {
  it("does not highlight text when no matches found", () => {
    const rootNodes = [createdFilterTargetHierarchyNode({ id: "node", label: "node" })];
    const onHighlightChangedStub = sinon.stub();

    const { result } = renderHook(useNodeHighlighting, {
      initialProps: { rootNodes, highlight: { text: "test", activeMatchIndex: undefined, onHighlightChanged: onHighlightChangedStub } },
    });

    expect(onHighlightChangedStub).to.be.calledWith(0, 0);
    const { container } = render(result.current.getLabel(rootNodes[0]));

    expect(container.querySelector("mark")).to.be.null;
  });

  it("does not highlight text when node is not filter target", () => {
    const rootNodes = [createPresentationHierarchyNode({ id: "node", label: "node" })];
    const onHighlightChangedStub = sinon.stub();

    const { result } = renderHook(useNodeHighlighting, {
      initialProps: { rootNodes, highlight: { text: "test", activeMatchIndex: undefined, onHighlightChanged: onHighlightChangedStub } },
    });

    expect(onHighlightChangedStub).to.be.calledWith(0, 0);
    const { container } = render(result.current.getLabel(rootNodes[0]));

    expect(container.querySelector("mark")).to.be.null;
  });

  it("highlights text when match found", () => {
    const rootNodes = [createdFilterTargetHierarchyNode({ id: "node", label: "node" })];
    const onHighlightChangedStub = sinon.stub();

    const { result } = renderHook(useNodeHighlighting, {
      initialProps: { rootNodes, highlight: { text: "node", activeMatchIndex: undefined, onHighlightChanged: onHighlightChangedStub } },
    });

    expect(onHighlightChangedStub).to.be.calledWith(0, 1);
    const { container } = render(result.current.getLabel(rootNodes[0]));

    expect(container.querySelector("mark")?.textContent).to.be.eq("node");
  });

  it("highlights text when match found on a node nested under grouping node", () => {
    const groupingNode = createPresentationHierarchyNode({ id: "grouping-node", label: "grouping node" });
    const rootNodes = [
      {
        ...groupingNode,
        nodeData: {
          ...groupingNode.nodeData,
          key: { type: "label-grouping", label: "grouped node" },
          groupedInstanceKeys: [],
        },
        children: [createdFilterTargetHierarchyNode({ id: "grouped-node", label: "grouped node" })],
      },
    ] satisfies PresentationHierarchyNode[];
    const onHighlightChangedStub = sinon.stub();

    const { result } = renderHook(useNodeHighlighting, {
      initialProps: { rootNodes, highlight: { text: "grouped node", activeMatchIndex: undefined, onHighlightChanged: onHighlightChangedStub } },
    });

    expect(onHighlightChangedStub).to.be.calledWith(0, 1);

    const groupingNodeRender = render(result.current.getLabel(rootNodes[0]));
    expect(groupingNodeRender.container.querySelector("mark")?.textContent).to.be.undefined;

    const groupedNodeRender = render(result.current.getLabel(rootNodes[0].children[0]));
    expect(groupedNodeRender.container.querySelector("mark")?.textContent).to.eq("grouped node");
  });

  it("highlights text in the middle", () => {
    const rootNodes = [createdFilterTargetHierarchyNode({ id: "node", label: "1 test 2" })];
    const onHighlightChangedStub = sinon.stub();

    const { result } = renderHook(useNodeHighlighting, {
      initialProps: { rootNodes, highlight: { text: "test", activeMatchIndex: undefined, onHighlightChanged: onHighlightChangedStub } },
    });

    expect(onHighlightChangedStub).to.be.calledWith(0, 1);
    const { container } = render(result.current.getLabel(rootNodes[0]));

    const spans = container.querySelectorAll("span");
    const marks = container.querySelectorAll("mark");

    expect(spans).to.have.length(2);
    expect(marks).to.have.length(1);
    expect(spans[0].textContent).to.be.eq("1 ");
    expect(spans[1].textContent).to.be.eq(" 2");
    expect(marks[0].textContent).to.be.eq("test");
  });

  it("highlights edges of text", () => {
    const rootNodes = [createdFilterTargetHierarchyNode({ id: "node", label: "test node test" })];
    const onHighlightChangedStub = sinon.stub();

    const { result } = renderHook(useNodeHighlighting, {
      initialProps: { rootNodes, highlight: { text: "test", activeMatchIndex: undefined, onHighlightChanged: onHighlightChangedStub } },
    });

    expect(onHighlightChangedStub).to.be.calledWith(0, 2);
    const { container } = render(result.current.getLabel(rootNodes[0]));

    const spans = container.querySelectorAll("span");
    const marks = container.querySelectorAll("mark");

    expect(spans).to.have.length(1);
    expect(marks).to.have.length(2);
    expect(spans[0].textContent).to.be.eq(" node ");
    expect(marks[0].textContent).to.be.eq("test");
    expect(marks[1].textContent).to.be.eq("test");
  });

  it("merges adjacent non-active chunks", () => {
    const rootNodes = [createdFilterTargetHierarchyNode({ id: "node", label: "OOOO" })];
    const onHighlightChangedStub = sinon.stub();

    const { result } = renderHook(useNodeHighlighting, {
      initialProps: { rootNodes, highlight: { text: "O", activeMatchIndex: undefined, onHighlightChanged: onHighlightChangedStub } },
    });

    expect(onHighlightChangedStub).to.be.calledWith(0, 4);
    const { container } = render(result.current.getLabel(rootNodes[0]));

    const marks = container.querySelectorAll("mark");

    expect(marks).to.have.length(1);
    expect(marks[0].textContent).to.be.eq("OOOO");
  });

  it("does not merge active chunk", () => {
    const rootNodes = [createdFilterTargetHierarchyNode({ id: "node", label: "OOOOO" })];
    const onHighlightChangedStub = sinon.stub();

    const { result } = renderHook(useNodeHighlighting, {
      initialProps: { rootNodes, highlight: { text: "O", activeMatchIndex: 2, onHighlightChanged: onHighlightChangedStub } },
    });

    expect(onHighlightChangedStub).to.be.calledWith(2, 5);
    const { container } = render(result.current.getLabel(rootNodes[0]));

    const marks = container.querySelectorAll("mark");

    expect(marks).to.have.length(3);
    expect(marks[0].textContent).to.be.eq("OO");
    expect(marks[1].textContent).to.be.eq("O");
    expect(marks[1].className).to.be.eq("tw-active-match-highlight");
    expect(marks[2].textContent).to.be.eq("OO");
  });

  it("adds and updates active match class", () => {
    const rootNodes = [createdFilterTargetHierarchyNode({ id: "node", label: "test test test" })];
    const onHighlightChangedStub = sinon.stub();

    const { result, rerender: rerenderHook } = renderHook(useNodeHighlighting, {
      initialProps: { rootNodes, highlight: { text: "test", activeMatchIndex: 0, onHighlightChanged: onHighlightChangedStub } },
    });

    expect(onHighlightChangedStub).to.be.calledWith(0, 3);
    const { container, rerender } = render(result.current.getLabel(rootNodes[0]));

    let spans = container.querySelectorAll("span");
    let marks = container.querySelectorAll("mark");

    expect(spans).to.have.length(2);
    expect(marks).to.have.length(3);
    expect(spans[0].textContent).to.be.eq(" ");
    expect(spans[1].textContent).to.be.eq(" ");
    expect(marks[0].textContent).to.be.eq("test");
    expect(marks[0].className).to.be.eq("tw-active-match-highlight");
    expect(marks[1].textContent).to.be.eq("test");
    expect(marks[2].textContent).to.be.eq("test");

    rerenderHook({ rootNodes, highlight: { text: "test", activeMatchIndex: 1, onHighlightChanged: onHighlightChangedStub } });
    rerender(result.current.getLabel(rootNodes[0]));

    spans = container.querySelectorAll("span");
    marks = container.querySelectorAll("mark");

    expect(spans).to.have.length(2);
    expect(marks).to.have.length(3);
    expect(spans[0].textContent).to.be.eq(" ");
    expect(spans[1].textContent).to.be.eq(" ");
    expect(marks[0].textContent).to.be.eq("test");
    expect(marks[1].textContent).to.be.eq("test");
    expect(marks[1].className).to.be.eq("tw-active-match-highlight");
    expect(marks[2].textContent).to.be.eq("test");
  });

  it("updates index when active node predecessor nodes change", () => {
    const rootNodes = [createdFilterTargetHierarchyNode({ id: "node", label: "OOOO" })];
    const onHighlightChangedStub = sinon.stub();

    const { result, rerender } = renderHook(useNodeHighlighting, {
      initialProps: { rootNodes, highlight: { text: "O", activeMatchIndex: 2, onHighlightChanged: onHighlightChangedStub } },
    });

    expect(onHighlightChangedStub).to.be.calledWith(2, 4);
    const { container } = render(result.current.getLabel(rootNodes[0]));

    const marks = container.querySelectorAll("mark");

    expect(marks).to.have.length(3);
    expect(marks[0].textContent).to.be.eq("OO");
    expect(marks[1].textContent).to.be.eq("O");
    expect(marks[1].className).to.be.eq("tw-active-match-highlight");
    expect(marks[2].textContent).to.be.eq("O");

    const newRootNodes = [
      createdFilterTargetHierarchyNode({ id: "predecessor-node", label: "O" }),
      createdFilterTargetHierarchyNode({ id: "node", label: "OOOO" }),
    ];

    onHighlightChangedStub.resetHistory();
    rerender({ rootNodes: newRootNodes, highlight: { text: "O", activeMatchIndex: 2, onHighlightChanged: onHighlightChangedStub } });

    expect(onHighlightChangedStub).to.be.calledWith(3, 5);
  });

  it("does not update index when active node successor nodes change", () => {
    const rootNodes = [createdFilterTargetHierarchyNode({ id: "node", label: "OOOO" })];
    const onHighlightChangedStub = sinon.stub();

    const { result, rerender } = renderHook(useNodeHighlighting, {
      initialProps: { rootNodes, highlight: { text: "O", activeMatchIndex: 2, onHighlightChanged: onHighlightChangedStub } },
    });

    expect(onHighlightChangedStub).to.be.calledWith(2, 4);
    const { container } = render(result.current.getLabel(rootNodes[0]));

    const marks = container.querySelectorAll("mark");

    expect(marks).to.have.length(3);
    expect(marks[0].textContent).to.be.eq("OO");
    expect(marks[1].textContent).to.be.eq("O");
    expect(marks[1].className).to.be.eq("tw-active-match-highlight");
    expect(marks[2].textContent).to.be.eq("O");

    const newRootNodes = [
      createdFilterTargetHierarchyNode({ id: "node", label: "OOOO" }),
      createdFilterTargetHierarchyNode({ id: "successor-node", label: "O" }),
    ];

    onHighlightChangedStub.resetHistory();
    rerender({ rootNodes: newRootNodes, highlight: { text: "O", activeMatchIndex: 2, onHighlightChanged: onHighlightChangedStub } });

    expect(onHighlightChangedStub).to.be.calledWith(2, 5);
  });

  it("returns currently active node", () => {
    const rootNodes = [createdFilterTargetHierarchyNode({ id: "node-1", label: "node" }), createdFilterTargetHierarchyNode({ id: "node-2", label: "node" })];
    const onHighlightChangedStub = sinon.stub();

    const { result, rerender } = renderHook(useNodeHighlighting, {
      initialProps: { rootNodes, highlight: { text: "node", activeMatchIndex: 0, onHighlightChanged: onHighlightChangedStub } },
    });

    expect(onHighlightChangedStub).to.be.calledWith(0, 2);
    expect(result.current.activeNodeId).to.be.equal("node-1");

    onHighlightChangedStub.resetHistory();
    rerender({ rootNodes, highlight: { text: "node", activeMatchIndex: 1, onHighlightChanged: onHighlightChangedStub } });

    expect(onHighlightChangedStub).to.not.be.called;
    expect(result.current.activeNodeId).to.be.equal("node-2");
  });

  it("clears active node when `searchText` is empty", () => {
    const rootNodes = [createdFilterTargetHierarchyNode({ id: "node", label: "node" })];
    const onHighlightChangedStub = sinon.stub();

    const { result, rerender } = renderHook(useNodeHighlighting, {
      initialProps: { rootNodes, highlight: { text: "node", activeMatchIndex: 0, onHighlightChanged: onHighlightChangedStub } },
    });

    expect(onHighlightChangedStub).to.be.calledWith(0, 1);
    expect(result.current.activeNodeId).to.be.equal("node");

    onHighlightChangedStub.resetHistory();
    rerender({ rootNodes, highlight: { text: "", activeMatchIndex: 1, onHighlightChanged: onHighlightChangedStub } });

    expect(onHighlightChangedStub).to.be.calledWith(0, 0);
    expect(result.current.activeNodeId).to.be.undefined;
  });

  it("clears active node when `rootNodes` is empty", () => {
    const rootNodes = [createdFilterTargetHierarchyNode({ id: "node", label: "node" })];
    const onHighlightChangedStub = sinon.stub();

    const { result, rerender } = renderHook(useNodeHighlighting, {
      initialProps: { rootNodes, highlight: { text: "node", activeMatchIndex: 0, onHighlightChanged: onHighlightChangedStub } },
    });

    expect(onHighlightChangedStub).to.be.calledWith(0, 1);
    expect(result.current.activeNodeId).to.be.equal("node");

    onHighlightChangedStub.resetHistory();
    rerender({ rootNodes: [], highlight: { text: "node", activeMatchIndex: 1, onHighlightChanged: onHighlightChangedStub } });

    expect(onHighlightChangedStub).to.be.calledWith(0, 0);
    expect(result.current.activeNodeId).to.be.undefined;
  });
});

function createdFilterTargetHierarchyNode(partial?: Partial<PresentationHierarchyNode>): PresentationHierarchyNode {
  const node = createPresentationHierarchyNode(partial);
  return {
    ...node,
    nodeData: {
      ...node.nodeData,
      filtering: {
        isFilterTarget: true,
      },
    },
  };
}
