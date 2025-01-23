/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { useNodeHighlighting } from "../../../components/trees/common/UseNodeHighlighting.js";
import { render, renderHook } from "../../TestUtils.js";
import { createPresentationHierarchyNode } from "../TreeUtils.js";

describe("useNodeHighlighting", () => {
  it("does not highlight text when no matches found", () => {
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
    const rootNodes = [createPresentationHierarchyNode({ id: "node", label: "node" })];
    const onHighlightChangedStub = sinon.stub();

    const { result } = renderHook(useNodeHighlighting, {
      initialProps: { rootNodes, highlight: { text: "node", activeMatchIndex: undefined, onHighlightChanged: onHighlightChangedStub } },
    });

    expect(onHighlightChangedStub).to.be.calledWith(0, 1);
    const { container } = render(result.current.getLabel(rootNodes[0]));

    expect(container.querySelector("mark")?.textContent).to.be.eq("node");
  });

  it("highlights text in the middle", () => {
    const rootNodes = [createPresentationHierarchyNode({ id: "node", label: "1 test 2" })];
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
    const rootNodes = [createPresentationHierarchyNode({ id: "node", label: "test node test" })];
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
    const rootNodes = [createPresentationHierarchyNode({ id: "node", label: "OOOO" })];
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
    const rootNodes = [createPresentationHierarchyNode({ id: "node", label: "OOOOO" })];
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
    const rootNodes = [createPresentationHierarchyNode({ id: "node", label: "test test test" })];
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
    const rootNodes = [createPresentationHierarchyNode({ id: "node", label: "OOOO" })];
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
      createPresentationHierarchyNode({ id: "predecessor-node", label: "O" }),
      createPresentationHierarchyNode({ id: "node", label: "OOOO" }),
    ];

    onHighlightChangedStub.resetHistory();
    rerender({ rootNodes: newRootNodes, highlight: { text: "O", activeMatchIndex: 2, onHighlightChanged: onHighlightChangedStub } });

    expect(onHighlightChangedStub).to.be.calledWith(3, 5);
  });

  it("does not update index when active node successor nodes change", () => {
    const rootNodes = [createPresentationHierarchyNode({ id: "node", label: "OOOO" })];
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
      createPresentationHierarchyNode({ id: "node", label: "OOOO" }),
      createPresentationHierarchyNode({ id: "successor-node", label: "O" }),
    ];

    onHighlightChangedStub.resetHistory();
    rerender({ rootNodes: newRootNodes, highlight: { text: "O", activeMatchIndex: 2, onHighlightChanged: onHighlightChangedStub } });

    expect(onHighlightChangedStub).to.be.calledWith(2, 5);
  });

  it("returns currently active node", () => {
    const rootNodes = [createPresentationHierarchyNode({ id: "node-1", label: "node" }), createPresentationHierarchyNode({ id: "node-2", label: "node" })];
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
    const rootNodes = [createPresentationHierarchyNode({ id: "node", label: "node" })];
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
    const rootNodes = [createPresentationHierarchyNode({ id: "node", label: "node" })];
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
