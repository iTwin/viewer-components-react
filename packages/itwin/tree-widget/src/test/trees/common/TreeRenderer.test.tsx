/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { TreeContextMenuItem } from "../../../components/trees/common/ContextMenu";
import { TreeRenderer } from "../../../components/trees/common/TreeRenderer";
import { registerRenderers } from "../../../components/trees/common/Utils";
import { render, waitFor } from "../../TestUtils";
import { createSimpleTreeModelNode } from "../Common";

import type { ITreeNodeLoader, TreeActions, TreeModel, VisibleTreeNodes } from "@itwin/components-react";
import type { TreeRendererProps } from "../../../components/trees/common/TreeRenderer";

describe("TreeRenderer", () => {
  const nodeLoader = {} as ITreeNodeLoader;
  const treeActions = {
    onNodeMouseDown: () => {},
    onNodeMouseMove: () => {},
  } as unknown as TreeActions;

  const node = createSimpleTreeModelNode("test-node", "Test Node");
  const visibleNodes = {
    getNumNodes: () => 1,
    getAtIndex: sinon.stub<Parameters<VisibleTreeNodes["getAtIndex"]>, ReturnType<VisibleTreeNodes["getAtIndex"]>>(),
    getIndexOfNode: () => 0,
    getNumRootNodes: () => 1,
    getModel: () => ({}) as TreeModel,
    *[Symbol.iterator]() {
      return;
    },
  };

  const initialProps: TreeRendererProps = {
    height: 200,
    width: 200,
    nodeHeight: () => 20,
    nodeLoader,
    treeActions,
    visibleNodes,
  };

  beforeEach(() => {
    visibleNodes.getAtIndex.returns(node);
  });

  afterEach(() => {
    visibleNodes.getAtIndex.reset();
  });

  it("opens context menu", async () => {
    const { user, getByText } = render(<TreeRenderer {...initialProps} contextMenuItems={[() => <div>Test Item</div>]} />);

    const nodeElement = await waitFor(() => getByText("Test Node"));
    await user.pointer({ keys: "[MouseRight>]", target: nodeElement });

    await waitFor(() => getByText("Test Item"));
  });

  it("doesn't open context menu if there are no items", async () => {
    const { user, getByText, queryByRole } = render(<TreeRenderer {...initialProps} />);

    const nodeElement = await waitFor(() => getByText("Test Node"));
    await user.pointer({ keys: "[MouseRight>]", target: nodeElement });

    expect(queryByRole("menu")).to.be.null;
  });

  it("renders context menu without size if item is `null`", async () => {
    const { user, getByText, getByRole } = render(<TreeRenderer {...initialProps} contextMenuItems={[() => null]} />);

    const nodeElement = await waitFor(() => getByText("Test Node"));
    await user.pointer({ keys: "[MouseRight>]", target: nodeElement });

    const item = await waitFor(() => getByRole("menu"));
    expect(item.clientWidth).to.be.eq(0);
    expect(item.clientHeight).to.be.eq(0);
  });

  it("closes context menu when item is clicked", async () => {
    const selectStub = sinon.stub();
    const { user, getByText, queryByText } = render(
      <TreeRenderer
        {...initialProps}
        contextMenuItems={[
          () => (
            <TreeContextMenuItem id="test-item" onSelect={selectStub}>
              Test Item
            </TreeContextMenuItem>
          ),
        ]}
      />,
    );

    // open menu
    const nodeElement = await waitFor(() => getByText("Test Node"));
    await user.pointer({ keys: "[MouseRight>]", target: nodeElement });

    // find item
    const item = await waitFor(() => getByText("Test Item"));

    // click item
    await user.click(item);

    // wait for item to disappear
    await waitFor(() => expect(queryByText("Test Item")).to.be.null);
    expect(selectStub).to.be.calledOnce;
  });

  it("renders `enlarged` nodes list", async () => {
    const { container } = render(<TreeRenderer {...initialProps} density={"enlarged"} />);

    await waitFor(() => expect(container.querySelector(".enlarge")).to.not.be.null); // eslint-disable-line deprecation/deprecation
  });

  it("marks node without expander", async () => {
    const nodeWithoutExpander = createSimpleTreeModelNode("test-node", "Test Node", { numChildren: 0 });
    visibleNodes.getAtIndex.reset();
    visibleNodes.getAtIndex.returns(nodeWithoutExpander);
    const { container } = render(<TreeRenderer {...initialProps} />);

    await waitFor(() => expect(container.querySelector(".without-expander")).to.not.be.null); // eslint-disable-line deprecation/deprecation
  });

  describe("custom labels", () => {
    let cleanup: () => void;

    before(() => {
      cleanup = registerRenderers();
    });

    after(() => {
      cleanup();
    });

    it("renders using default renderer", async () => {
      const { queryByText } = render(<TreeRenderer {...initialProps} />);

      await waitFor(() => expect(queryByText("Test Node")).to.not.be.null);
    });

    it("renders using custom renderer", async () => {
      const { queryByText } = render(<TreeRenderer {...initialProps} nodeLabelRenderer={() => "Custom label"} />);

      await waitFor(() => expect(queryByText("Custom label")).to.not.be.null);
    });
  });
});
