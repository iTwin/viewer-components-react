/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./VisibilityTreeRenderer.scss";
import { useCallback } from "react";
import { Tree } from "@itwin/itwinui-react";
import { createRenderedTreeNodeData } from "@itwin/presentation-hierarchies-react";
import { VisibilityTreeNodeRenderer } from "./VisibilityTreeNodeRenderer";

import type { ComponentPropsWithoutRef } from "react";
import type { PresentationTreeNode, RenderedTreeNode } from "@itwin/presentation-hierarchies-react";

interface VisibilityTreeRendererOwnProps {
  rootNodes: PresentationTreeNode[];
  isNodeSelected: (nodeId: string) => boolean;
}

type VisibilityTreeRendererProps = Pick<
  VisibilityTreeNodeRendererProps,
  | "expandNode"
  | "onNodeClick"
  | "onNodeKeyDown"
  | "onFilterClick"
  | "getIcon"
  | "getSublabel"
  | "getCheckboxStatus"
  | "onCheckboxClicked"
  | "getHierarchyLevelDetails"
> &
  Omit<TreeProps<RenderedTreeNode>, "data" | "nodeRenderer" | "getNode"> &
  VisibilityTreeRendererOwnProps;

/** @internal */
export function VisibilityTreeRenderer({
  rootNodes,
  expandNode,
  onNodeClick,
  onNodeKeyDown,
  isNodeSelected,
  onFilterClick,
  getIcon,
  getSublabel,
  getCheckboxStatus,
  onCheckboxClicked,
  getHierarchyLevelDetails,
  ...props
}: VisibilityTreeRendererProps) {
  const nodeRenderer = useCallback<TreeProps<RenderedTreeNode>["nodeRenderer"]>(
    (nodeProps) => {
      return (
        <VisibilityTreeNodeRenderer
          {...nodeProps}
          expandNode={expandNode}
          onNodeClick={onNodeClick}
          onNodeKeyDown={onNodeKeyDown}
          getIcon={getIcon}
          getSublabel={getSublabel}
          getCheckboxStatus={getCheckboxStatus}
          onCheckboxClicked={onCheckboxClicked}
          onFilterClick={onFilterClick}
          getHierarchyLevelDetails={getHierarchyLevelDetails}
        />
      );
    },
    [expandNode, onNodeClick, onNodeKeyDown, getHierarchyLevelDetails, getIcon, getSublabel, getCheckboxStatus, onCheckboxClicked, onFilterClick],
  );

  const getNode = useCallback<TreeProps<RenderedTreeNode>["getNode"]>((node) => createRenderedTreeNodeData(node, isNodeSelected), [isNodeSelected]);

  return (
    <Tree<RenderedTreeNode>
      {...props}
      className="tw-visibility-tree-renderer"
      data={rootNodes}
      nodeRenderer={nodeRenderer}
      getNode={getNode}
      enableVirtualization={true}
    />
  );
}

type TreeProps<T> = ComponentPropsWithoutRef<typeof Tree<T>>;
type VisibilityTreeNodeRendererProps = ComponentPropsWithoutRef<typeof VisibilityTreeNodeRenderer>;
