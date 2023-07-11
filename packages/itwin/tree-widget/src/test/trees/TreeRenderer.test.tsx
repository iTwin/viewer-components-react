/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { waitFor } from "@testing-library/react";
import { TreeContextMenuItem } from "../../components/trees/ContextMenu";
import { TreeRenderer } from "../../components/trees/TreeRenderer";
import { createSimpleTreeModelNode } from "./Common";

import type { ITreeNodeLoader, TreeActions, TreeModel, VisibleTreeNodes } from "@itwin/components-react";
import type { TreeRendererProps } from "../../components/trees/TreeRenderer";
import { renderWithUser } from "../TestUtils";

describe("TreeRenderer", () => {
  const nodeLoader = {} as ITreeNodeLoader;
  const treeActions = {} as TreeActions;

  const node = createSimpleTreeModelNode("test-node", "Test Node");
  const visibleNodes = {
    getNumNodes: () => 1,
    getAtIndex: () => node,
    getIndexOfNode: () => 0,
    getNumRootNodes: () => 1,
    getModel: () => ({} as TreeModel),
    *[Symbol.iterator]() { return; },
  } as VisibleTreeNodes;

  const initialProps: TreeRendererProps = {
    height: 200,
    width: 200,
    nodeHeight: () => 20,
    nodeLoader,
    treeActions,
    visibleNodes,
  };

  it("opens context menu", async () => {
    const { user, getByText } = renderWithUser(
      <TreeRenderer
        {...initialProps}
        contextMenuItems={[() => <div>Test Item</div>]}
      />
    );

    const nodeElement = await waitFor(() => getByText("Test Node"));
    await user.pointer({ keys: "[MouseRight>]", target: nodeElement });

    await waitFor(() => getByText("Test Item"));
  });

  it("doesn't open context menu if there are no items", async () => {
    const { user, getByText, queryByRole } = renderWithUser(
      <TreeRenderer
        {...initialProps}
      />
    );

    const nodeElement = await waitFor(() => getByText("Test Node"));
    await user.pointer({ keys: "[MouseRight>]", target: nodeElement });

    expect(queryByRole("menu")).to.be.null;
  });

  it("renders context menu without size if item is `null`", async () => {
    const { user, getByText, queryByRole, getByRole } = renderWithUser(
      <TreeRenderer
        {...initialProps}
        contextMenuItems={[
          () => null,
        ]}
      />
    );

    const nodeElement = await waitFor(() => getByText("Test Node"));
    await user.pointer({ keys: "[MouseRight>]", target: nodeElement });

    const item = await waitFor(() => getByRole("menu"));
    expect(item.clientWidth).to.be.eq(0);
    expect(item.clientHeight).to.be.eq(0);
  });

  it("closes context menu when item is clicked", async () => {
    const selectStub = sinon.stub();
    const { user, getByText, queryByText } = renderWithUser(
      <TreeRenderer
        {...initialProps}
        contextMenuItems={[() => <TreeContextMenuItem id="test-item" onSelect={selectStub}>Test Item</TreeContextMenuItem>]}
      />
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
});
