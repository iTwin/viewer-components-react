/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { PropertyRecord } from "@itwin/appui-abstract";
import { CheckBoxState } from "@itwin/core-react";
import { render, waitFor } from "@testing-library/react";
import { createVisibilityTreeNodeRenderer } from "../../components/trees/VisibilityTreeRenderer";

import type { TreeActions, TreeModelNode } from "@itwin/components-react";

describe("VisibilityTreeRenderer", () => {
  const rootNode: TreeModelNode = {
    id: "root-node",
    description: "root-node-description",
    label: PropertyRecord.fromString("root-node"),
    isExpanded: true,
    isSelected: false,
    checkbox: {
      state: CheckBoxState.Off,
      isDisabled: false,
      isVisible: true,
    },
    item: {
      id: "root-node",
      label: PropertyRecord.fromString("root-node"),
    },
    parentId: undefined,
    depth: 0,
    numChildren: 1,
  };
  const middleNode: TreeModelNode = {
    ...rootNode,
    id: "middle-node",
    description: "middle-node-description",
    label: PropertyRecord.fromString("middle-node"),
    item: {
      id: "middle-node",
      label: PropertyRecord.fromString("middle-node"),
    },
    parentId: "root-node",
    depth: 1,
  };

  const leafNode: TreeModelNode = {
    ...middleNode,
    id: "leaf-node",
    description: "leaf-node-description",
    label: PropertyRecord.fromString("leaf-node"),
    item: {
      id: "leaf-node",
      label: PropertyRecord.fromString("leaf-node"),
    },
    parentId: "middle-node",
    depth: 1,
    numChildren: 0,
  };

  describe("createVisibilityTreeNodeRenderer", () => {
    it("renders nodes with default values", async () => {
      const { getByTestId, rerender } = render(createVisibilityTreeNodeRenderer({ iconsEnabled: false, descriptionEnabled: false })({ node: rootNode, treeActions: {} as TreeActions }));
      const renderedRootNode = await waitFor(() => getByTestId("tree-node-contents"));
      expect((renderedRootNode.children[1] as HTMLDivElement).style.marginRight).to.be.eq("0px");

      rerender((createVisibilityTreeNodeRenderer({ iconsEnabled: false, descriptionEnabled: false })({ node: middleNode, treeActions: {} as TreeActions })));
      const renderedMiddleNode = await waitFor(() => getByTestId("tree-node-contents"));
      expect((renderedMiddleNode.children[1] as HTMLDivElement).style.marginRight).to.be.eq("20px");

      rerender((createVisibilityTreeNodeRenderer({ iconsEnabled: false, descriptionEnabled: false })({ node: leafNode, treeActions: {} as TreeActions })));
      const renderedLeafNode = await waitFor(() => getByTestId("tree-node-contents"));
      expect((renderedLeafNode.children[1] as HTMLDivElement).style.marginRight).to.be.eq("44px");
    });

    it("disables expander for root node when `disableRootNodeCollapse` is set to true", async () => {
      const { getByTestId, rerender } = render(createVisibilityTreeNodeRenderer({ iconsEnabled: false, descriptionEnabled: false, disableRootNodeCollapse: true })({ node: rootNode, treeActions: {} as TreeActions }));
      const renderedRootNode = await waitFor(() => getByTestId("tree-node"));
      expect(renderedRootNode.className.includes("disable-expander")).to.be.eq(true);

      rerender((createVisibilityTreeNodeRenderer({ iconsEnabled: false, descriptionEnabled: false, disableRootNodeCollapse: true })({ node: middleNode, treeActions: {} as TreeActions })));

      const renderedMiddleNode = await waitFor(() => getByTestId("tree-node"));
      expect(renderedMiddleNode.className.includes("disable-expander")).to.be.eq(false);

      rerender((createVisibilityTreeNodeRenderer({ iconsEnabled: false, descriptionEnabled: false, disableRootNodeCollapse: true })({ node: leafNode, treeActions: {} as TreeActions })));
      const renderedLeafNode = await waitFor(() => getByTestId("tree-node"));
      expect(renderedLeafNode.className.includes("disable-expander")).to.be.eq(true);
    });

    it("renders nodes with custom `levelOffset` value", async () => {
      const { getByTestId, rerender } = render(createVisibilityTreeNodeRenderer({ iconsEnabled: false, descriptionEnabled: false, levelOffset: 10 })({ node: rootNode, treeActions: {} as TreeActions }));
      const renderedRootNode = await waitFor(() => getByTestId("tree-node-contents"));
      expect((renderedRootNode.children[1] as HTMLDivElement).style.marginRight).to.be.eq("0px");

      rerender((createVisibilityTreeNodeRenderer({ iconsEnabled: false, descriptionEnabled: false, levelOffset: 10 })({ node: middleNode, treeActions: {} as TreeActions })));
      const renderedMiddleNode = await waitFor(() => getByTestId("tree-node-contents"));
      expect((renderedMiddleNode.children[1] as HTMLDivElement).style.marginRight).to.be.eq("10px");

      rerender((createVisibilityTreeNodeRenderer({ iconsEnabled: false, descriptionEnabled: false, levelOffset: 10 })({ node: leafNode, treeActions: {} as TreeActions })));
      const renderedLeafNode = await waitFor(() => getByTestId("tree-node-contents"));
      expect((renderedLeafNode.children[1] as HTMLDivElement).style.marginRight).to.be.eq("34px");
    });
  });
});
