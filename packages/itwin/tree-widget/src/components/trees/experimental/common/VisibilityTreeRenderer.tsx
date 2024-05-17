/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Tree } from "@itwin/itwinui-react";
import { PresentationHierarchyNode, PresentationTreeNode, createTreeNode } from "@itwin/presentation-hierarchies-react";
import { ComponentPropsWithoutRef, useCallback } from "react";
import { VisibilityStatus } from "../../VisibilityTreeEventHandler";
import { VisibilityTreeNodeRenderer } from "./VisibilityTreeNodeRenderer";
import "./VisibilityTreeRenderer.scss";

type TreeProps<T> = ComponentPropsWithoutRef<typeof Tree<T>>;
type VisibilityTreeNodeRendererProps = ComponentPropsWithoutRef<typeof VisibilityTreeNodeRenderer>;

interface VisibilityTreeRendererOwnProps {
  rootNodes: PresentationTreeNode[];
  isNodeSelected: (nodeId: string) => boolean;
  getCheckboxStatus: (node: PresentationHierarchyNode) => VisibilityStatus;
  onCheckboxClicked: (node: PresentationHierarchyNode, checked: boolean) => void;
}

type VisibilityTreeRendererProps = Pick<
  VisibilityTreeNodeRendererProps,
  "expandNode" | "onNodeClick" | "onNodeKeyDown" | "setHierarchyLevelLimit" | "setHierarchyLevelFilter" | "onFilterClick" | "getIcon"
> &
  Omit<TreeProps<PresentationTreeNode>, "data" | "nodeRenderer" | "getNode"> &
  VisibilityTreeRendererOwnProps;

/** @internal */
export function VisibilityTreeRenderer({
  rootNodes,
  expandNode,
  onNodeClick,
  onNodeKeyDown,
  isNodeSelected,
  setHierarchyLevelLimit,
  setHierarchyLevelFilter,
  onFilterClick,
  getIcon,
  getCheckboxStatus,
  onCheckboxClicked,
  ...props
}: VisibilityTreeRendererProps) {
  const nodeRenderer = useCallback<TreeProps<PresentationTreeNode>["nodeRenderer"]>(
    (nodeProps) => {
      return (
        <VisibilityTreeNodeRenderer
          {...nodeProps}
          expandNode={expandNode}
          onNodeClick={onNodeClick}
          onNodeKeyDown={onNodeKeyDown}
          getIcon={getIcon}
          setHierarchyLevelFilter={setHierarchyLevelFilter}
          setHierarchyLevelLimit={setHierarchyLevelLimit}
          getCheckboxStatus={getCheckboxStatus}
          onCheckboxClicked={onCheckboxClicked}
          onFilterClick={onFilterClick}
        />
      );
    },
    [expandNode, onNodeClick, onNodeKeyDown, setHierarchyLevelLimit, setHierarchyLevelFilter, getIcon, getCheckboxStatus, onCheckboxClicked, onFilterClick],
  );

  const getNode = useCallback<TreeProps<PresentationTreeNode>["getNode"]>((node) => createTreeNode(node, isNodeSelected), [isNodeSelected]);

  return (
    <Tree<PresentationTreeNode>
      {...props}
      className="visibility-tree-renderer"
      data={rootNodes}
      nodeRenderer={nodeRenderer}
      getNode={getNode}
      enableVirtualization={true}
    />
  );
}
