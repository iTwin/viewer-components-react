/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./TreeRenderer.scss";

import { useCallback } from "react";
import { Tree } from "@itwin/itwinui-react";
import { createRenderedTreeNodeData, LocalizationContextProvider } from "@itwin/presentation-hierarchies-react";
import { TreeNodeRenderer } from "./TreeNodeRenderer";
import { useHierarchiesLocalization } from "../UseHierarchiesLocalization";

import type { TreeNodeRendererProps } from "./TreeNodeRenderer";
import type { ComponentPropsWithoutRef } from "react";
import type { PresentationHierarchyNode, PresentationTreeNode, RenderedTreeNode } from "@itwin/presentation-hierarchies-react";

/** @beta */
export type TreeRendererProps = Pick<
  TreeNodeRendererProps,
  | "expandNode"
  | "onNodeClick"
  | "onNodeKeyDown"
  | "onFilterClick"
  | "getIcon"
  | "getLabel"
  | "getSublabel"
  | "getHierarchyLevelDetails"
  | "checkboxProps"
  | "reloadTree"
> &
  Omit<ComponentPropsWithoutRef<typeof Tree<RenderedTreeNode>>, "data" | "nodeRenderer" | "getNode"> & {
    /** Tree nodes to render. */
    rootNodes: PresentationTreeNode[];
    /** Callback to check if specific node is selected. */
    isNodeSelected: (nodeId: string) => boolean;
    /** Callback that is invoked when node is double clicked. */
    onNodeDoubleClick?: (node: PresentationHierarchyNode, isSelected: boolean) => void;
  };

/**
 * Default renderer for rendering tree data.
 * @beta
 */
export function TreeRenderer({
  rootNodes,
  expandNode,
  onNodeClick,
  onNodeKeyDown,
  onNodeDoubleClick,
  isNodeSelected,
  onFilterClick,
  getIcon,
  getLabel,
  getSublabel,
  getHierarchyLevelDetails,
  checkboxProps,
  reloadTree,
  size,
  ...props
}: TreeRendererProps) {
  const localizedStrings = useHierarchiesLocalization();
  const nodeRenderer = useCallback<ComponentPropsWithoutRef<typeof Tree<RenderedTreeNode>>["nodeRenderer"]>(
    (nodeProps) => {
      return (
        <TreeNodeRenderer
          {...nodeProps}
          onNodeClick={(node, isSelected, event) => {
            if (onNodeDoubleClick && event.detail === 2) {
              onNodeDoubleClick?.(node, !!nodeProps.isSelected);
              // Click node to not lose selection
              return onNodeClick?.(node, true, event);
            }
            onNodeClick?.(node, isSelected, event);
          }}
          expandNode={expandNode}
          onNodeKeyDown={onNodeKeyDown}
          getIcon={getIcon}
          getLabel={getLabel}
          getSublabel={getSublabel}
          onFilterClick={onFilterClick}
          getHierarchyLevelDetails={getHierarchyLevelDetails}
          checkboxProps={checkboxProps}
          reloadTree={reloadTree}
          className={getSublabel ? "with-description" : "without-description"}
          size={size}
        />
      );
    },
    [
      expandNode,
      onNodeClick,
      onNodeKeyDown,
      onNodeDoubleClick,
      getHierarchyLevelDetails,
      getIcon,
      getLabel,
      getSublabel,
      onFilterClick,
      checkboxProps,
      reloadTree,
      size,
    ],
  );

  const getNode = useCallback<ComponentPropsWithoutRef<typeof Tree<RenderedTreeNode>>["getNode"]>(
    (node) => createRenderedTreeNodeData(node, isNodeSelected),
    [isNodeSelected],
  );

  return (
    <LocalizationContextProvider localizedStrings={localizedStrings}>
      <Tree<RenderedTreeNode>
        {...props}
        className="tw-tree-renderer"
        data={rootNodes}
        nodeRenderer={nodeRenderer}
        getNode={getNode}
        enableVirtualization={true}
        style={{ height: "100%" }}
        size={size}
      />
    </LocalizationContextProvider>
  );
}
