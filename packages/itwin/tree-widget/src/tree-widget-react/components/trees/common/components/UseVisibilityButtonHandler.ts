/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback } from "react";
import { isPresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import { useLatest } from "../internal/Utils.js";

import type { PresentationHierarchyNode, PresentationTreeNode } from "@itwin/presentation-hierarchies-react";
import type { TreeItemVisibilityButtonProps } from "./TreeNodeVisibilityButton.js";

interface UseVisibilityButtonHandlerProps {
  rootNodes: PresentationTreeNode[] | undefined;
  isNodeSelected?: (nodeId: string) => boolean;
  onClick: TreeItemVisibilityButtonProps["onVisibilityButtonClick"];
}

interface UseVisibilityButtonHandlerResult {
  onVisibilityButtonClick: TreeItemVisibilityButtonProps["onVisibilityButtonClick"];
}

/** @internal */
export function useVisibilityButtonHandler({ rootNodes, isNodeSelected, onClick }: UseVisibilityButtonHandlerProps): UseVisibilityButtonHandlerResult {
  const isNodeSelectedRef = useLatest(isNodeSelected);
  const rootNodesRef = useLatest(rootNodes);

  const onVisibilityButtonClick = useCallback<TreeItemVisibilityButtonProps["onVisibilityButtonClick"]>(
    (clickedNode, state) => {
      if (!isNodeSelectedRef.current?.(clickedNode.id)) {
        onClick(clickedNode, state);
        return;
      }
      rootNodesRef.current && forEachSelectedNode(rootNodesRef.current, isNodeSelectedRef.current, (node) => onClick(node, state));
    },
    [onClick, isNodeSelectedRef, rootNodesRef],
  );

  return { onVisibilityButtonClick };
}

function forEachSelectedNode(
  nodes: Array<PresentationTreeNode>,
  isNodeSelected: (nodeId: string) => boolean,
  callback: (node: PresentationHierarchyNode) => void,
) {
  nodes.forEach((node) => {
    if (!isPresentationHierarchyNode(node)) {
      return;
    }
    if (isNodeSelected(node.id)) {
      callback(node);
    }
    if (node.isExpanded && typeof node.children !== "boolean") {
      forEachSelectedNode(node.children, isNodeSelected, callback);
    }
  });
}
