/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { useNodeHighlighting } from "../../../../components/trees/stateless/common/UseNodeHighlighting";
import { render, renderHook } from "../../../TestUtils";
import { createPresentationHierarchyNode } from "../TreeUtils";

describe("useNodeHighlighting", () => {
  it("does not highlight text when no matches found", () => {
    const rootNodes = [createPresentationHierarchyNode({ id: "node", label: "node" })];
    const onHighlightChangedStub = sinon.stub();

    const { result } = renderHook((props) => useNodeHighlighting(props), {
      initialProps: { rootNodes, textToHighlight: "test", activeMatchIndex: undefined, onHighlightChanged: onHighlightChangedStub },
    });

    expect(onHighlightChangedStub).to.be.calledWith(0, 0);
    const { container } = render(result.current.getLabel(rootNodes[0]));

    expect(container.querySelector("mark")).to.be.null;
  });

  it("highlights text when match found", () => {
    const rootNodes = [createPresentationHierarchyNode({ id: "node", label: "node" })];
    const onHighlightChangedStub = sinon.stub();

    const { result } = renderHook((props) => useNodeHighlighting(props), {
      initialProps: { rootNodes, textToHighlight: "node", activeMatchIndex: undefined, onHighlightChanged: onHighlightChangedStub },
    });

    expect(onHighlightChangedStub).to.be.calledWith(0, 1);
    const { container } = render(result.current.getLabel(rootNodes[0]));

    expect(container.querySelector("mark")?.textContent).to.be.eq("node");
  });

  it("highlights text when `caseSensitive` set to true", () => {
    const rootNodes = [createPresentationHierarchyNode({ id: "node", label: "oOo" })];
    const onHighlightChangedStub = sinon.stub();

    const { result } = renderHook((props) => useNodeHighlighting(props), {
      initialProps: { rootNodes, textToHighlight: "O", caseSensitive: true, activeMatchIndex: undefined, onHighlightChanged: onHighlightChangedStub },
    });

    expect(onHighlightChangedStub).to.be.calledWith(0, 1);
    const { container } = render(result.current.getLabel(rootNodes[0]));

    const spans = container.querySelectorAll("span");
    const marks = container.querySelectorAll("mark");

    expect(spans).to.have.length(2);
    expect(marks).to.have.length(1);
    expect(spans[0].textContent).to.be.eq("o");
    expect(spans[1].textContent).to.be.eq("o");
    expect(marks[0].textContent).to.be.eq("O");
  });

  it("highlights text in the middle", () => {
    const rootNodes = [createPresentationHierarchyNode({ id: "node", label: "1 test 2" })];
    const onHighlightChangedStub = sinon.stub();

    const { result } = renderHook((props) => useNodeHighlighting(props), {
      initialProps: { rootNodes, textToHighlight: "test", caseSensitive: false, activeMatchIndex: undefined, onHighlightChanged: onHighlightChangedStub },
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

    const { result } = renderHook((props) => useNodeHighlighting(props), {
      initialProps: { rootNodes, textToHighlight: "test", caseSensitive: false, activeMatchIndex: undefined, onHighlightChanged: onHighlightChangedStub },
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

    const { result } = renderHook((props) => useNodeHighlighting(props), {
      initialProps: { rootNodes, textToHighlight: "O", caseSensitive: false, activeMatchIndex: undefined, onHighlightChanged: onHighlightChangedStub },
    });

    expect(onHighlightChangedStub).to.be.calledWith(0, 4);
    const { container } = render(result.current.getLabel(rootNodes[0]));

    const marks = container.querySelectorAll("mark");

    expect(marks).to.have.length(1);
    expect(marks[0].textContent).to.be.eq("OOOO");
  });

  it("does not merge adjacent chunks when one of them is active", () => {
    const rootNodes = [createPresentationHierarchyNode({ id: "node", label: "OOOO" })];
    const onHighlightChangedStub = sinon.stub();

    const { result } = renderHook((props) => useNodeHighlighting(props), {
      initialProps: { rootNodes, textToHighlight: "O", caseSensitive: false, activeMatchIndex: 0, onHighlightChanged: onHighlightChangedStub },
    });

    expect(onHighlightChangedStub).to.be.calledWith(0, 4);
    const { container } = render(result.current.getLabel(rootNodes[0]));

    const marks = container.querySelectorAll("mark");

    expect(marks).to.have.length(4);
    expect(marks[0].textContent).to.be.eq("O");
    expect(marks[1].textContent).to.be.eq("O");
    expect(marks[2].textContent).to.be.eq("O");
    expect(marks[3].textContent).to.be.eq("O");
  });

  it("adds and updates active match class", () => {
    const rootNodes = [createPresentationHierarchyNode({ id: "node", label: "test test test" })];
    const onHighlightChangedStub = sinon.stub();

    const { result, rerender: rerenderHook } = renderHook((props) => useNodeHighlighting(props), {
      initialProps: { rootNodes, textToHighlight: "test", caseSensitive: false, activeMatchIndex: 0, onHighlightChanged: onHighlightChangedStub },
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

    rerenderHook({ rootNodes, textToHighlight: "test", caseSensitive: false, activeMatchIndex: 1, onHighlightChanged: onHighlightChangedStub });
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

    const { result, rerender } = renderHook((props) => useNodeHighlighting(props), {
      initialProps: { rootNodes, textToHighlight: "O", caseSensitive: false, activeMatchIndex: 2, onHighlightChanged: onHighlightChangedStub },
    });

    expect(onHighlightChangedStub).to.be.calledWith(2, 4);
    const { container } = render(result.current.getLabel(rootNodes[0]));

    const marks = container.querySelectorAll("mark");

    expect(marks).to.have.length(4);
    expect(marks[0].textContent).to.be.eq("O");
    expect(marks[1].textContent).to.be.eq("O");
    expect(marks[2].textContent).to.be.eq("O");
    expect(marks[2].className).to.be.eq("tw-active-match-highlight");
    expect(marks[3].textContent).to.be.eq("O");

    const newRootNodes = [
      createPresentationHierarchyNode({ id: "predecessor-node", label: "O" }),
      createPresentationHierarchyNode({ id: "node", label: "OOOO" }),
    ];

    onHighlightChangedStub.resetHistory();
    rerender({ rootNodes: newRootNodes, textToHighlight: "O", caseSensitive: false, activeMatchIndex: 2, onHighlightChanged: onHighlightChangedStub });

    expect(onHighlightChangedStub).to.be.calledWith(3, 5);
  });

  it("does not update index when active node successor nodes change", () => {
    const rootNodes = [createPresentationHierarchyNode({ id: "node", label: "OOOO" })];
    const onHighlightChangedStub = sinon.stub();

    const { result, rerender } = renderHook((props) => useNodeHighlighting(props), {
      initialProps: { rootNodes, textToHighlight: "O", caseSensitive: false, activeMatchIndex: 2, onHighlightChanged: onHighlightChangedStub },
    });

    expect(onHighlightChangedStub).to.be.calledWith(2, 4);
    const { container } = render(result.current.getLabel(rootNodes[0]));

    const marks = container.querySelectorAll("mark");

    expect(marks).to.have.length(4);
    expect(marks[0].textContent).to.be.eq("O");
    expect(marks[1].textContent).to.be.eq("O");
    expect(marks[2].textContent).to.be.eq("O");
    expect(marks[2].className).to.be.eq("tw-active-match-highlight");
    expect(marks[3].textContent).to.be.eq("O");

    const newRootNodes = [
      createPresentationHierarchyNode({ id: "node", label: "OOOO" }),
      createPresentationHierarchyNode({ id: "successor-node", label: "O" }),
    ];

    onHighlightChangedStub.resetHistory();
    rerender({ rootNodes: newRootNodes, textToHighlight: "O", caseSensitive: false, activeMatchIndex: 2, onHighlightChanged: onHighlightChangedStub });

    expect(onHighlightChangedStub).to.be.calledWith(2, 5);
  });

  it("resets active index when `textToHighlight` changes", () => {
    const rootNodes = [createPresentationHierarchyNode({ id: "node", label: "OO" })];
    const onHighlightChangedStub = sinon.stub();

    const { result, rerender } = renderHook((props) => useNodeHighlighting(props), {
      initialProps: { rootNodes, textToHighlight: "O", caseSensitive: false, activeMatchIndex: 1, onHighlightChanged: onHighlightChangedStub },
    });

    expect(onHighlightChangedStub).to.be.calledWith(1, 2);
    const { container } = render(result.current.getLabel(rootNodes[0]));

    const marks = container.querySelectorAll("mark");

    expect(marks).to.have.length(2);
    expect(marks[0].textContent).to.be.eq("O");
    expect(marks[1].textContent).to.be.eq("O");
    expect(marks[1].className).to.be.eq("tw-active-match-highlight");

    onHighlightChangedStub.resetHistory();
    rerender({ rootNodes, textToHighlight: "K", caseSensitive: false, activeMatchIndex: 1, onHighlightChanged: onHighlightChangedStub });

    expect(onHighlightChangedStub).to.be.calledWith(0, 0);
  });

  it("resets active index when `caseSensitive` changes", () => {
    const rootNodes = [createPresentationHierarchyNode({ id: "node", label: "OO" })];
    const onHighlightChangedStub = sinon.stub();

    const { result, rerender } = renderHook((props) => useNodeHighlighting(props), {
      initialProps: { rootNodes, textToHighlight: "O", caseSensitive: false, activeMatchIndex: 1, onHighlightChanged: onHighlightChangedStub },
    });

    expect(onHighlightChangedStub).to.be.calledWith(1, 2);
    const { container } = render(result.current.getLabel(rootNodes[0]));

    const marks = container.querySelectorAll("mark");

    expect(marks).to.have.length(2);
    expect(marks[0].textContent).to.be.eq("O");
    expect(marks[1].textContent).to.be.eq("O");
    expect(marks[1].className).to.be.eq("tw-active-match-highlight");

    onHighlightChangedStub.resetHistory();
    rerender({ rootNodes, textToHighlight: "O", caseSensitive: true, activeMatchIndex: 1, onHighlightChanged: onHighlightChangedStub });

    expect(onHighlightChangedStub).to.be.calledWith(0, 2);
  });
});
