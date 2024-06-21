/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./TreeRenderer.scss";
import { useCallback } from "react";
import { Tree } from "@itwin/itwinui-react";
import { createRenderedTreeNodeData, LocalizationContextProvider } from "@itwin/presentation-hierarchies-react";
import { TreeNodeRenderer } from "./TreeNodeRenderer";

import type { ComponentPropsWithoutRef } from "react";
import type { PresentationHierarchyNode, PresentationTreeNode, RenderedTreeNode } from "@itwin/presentation-hierarchies-react";

interface TreeRendererOwnProps {
  rootNodes: PresentationTreeNode[];
  isNodeSelected: (nodeId: string) => boolean;
  onNodeDoubleClick?: (node: PresentationHierarchyNode, isSelected: boolean) => void;
}

type TreeRendererProps = Pick<
  TreeNodeRendererProps,
  "expandNode" | "onNodeClick" | "onNodeKeyDown" | "onFilterClick" | "getIcon" | "getLabel" | "getSublabel" | "getHierarchyLevelDetails" | "checkboxProps"
> &
  Omit<TreeProps<RenderedTreeNode>, "data" | "nodeRenderer" | "getNode"> &
  Pick<LocalizationContextProviderProps, "localizedStrings"> &
  TreeRendererOwnProps;

/** @internal */
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
  localizedStrings,
  ...props
}: TreeRendererProps) {
  const nodeRenderer = useCallback<TreeProps<RenderedTreeNode>["nodeRenderer"]>(
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
          className={getSublabel ? "with-description" : "without-description"}
        />
      );
    },
    [expandNode, onNodeClick, onNodeKeyDown, onNodeDoubleClick, getHierarchyLevelDetails, getIcon, getLabel, getSublabel, onFilterClick, checkboxProps],
  );

  const getNode = useCallback<TreeProps<RenderedTreeNode>["getNode"]>((node) => createRenderedTreeNodeData(node, isNodeSelected), [isNodeSelected]);

  return (
    <LocalizationContextProvider localizedStrings={localizedStrings}>
      <Tree<RenderedTreeNode>
        {...props}
        className="tw-tree-renderer"
        data={rootNodes}
        nodeRenderer={nodeRenderer}
        getNode={getNode}
        enableVirtualization={true}
      />
    </LocalizationContextProvider>
  );
}

type TreeProps<T> = ComponentPropsWithoutRef<typeof Tree<T>>;
type TreeNodeRendererProps = ComponentPropsWithoutRef<typeof TreeNodeRenderer>;
type LocalizationContextProviderProps = ComponentPropsWithoutRef<typeof LocalizationContextProvider>;
