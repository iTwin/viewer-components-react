/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback } from "react";
import { useLatest } from "../internal/Utils.js";

import type { TreeNode } from "@itwin/presentation-hierarchies-react";
import type { VisibilityContext } from "./TreeNodeVisibilityButton.js";

interface UseVisibilityButtonHandlerProps {
  rootNodes: TreeNode[] | undefined;
  isNodeSelected?: (nodeId: string) => boolean;
  onClick: VisibilityContext["onVisibilityButtonClick"];
}

interface UseVisibilityButtonHandlerResult {
  onVisibilityButtonClick: VisibilityContext["onVisibilityButtonClick"];
}

/** @internal */
export function useVisibilityButtonHandler({ rootNodes, isNodeSelected, onClick }: UseVisibilityButtonHandlerProps): UseVisibilityButtonHandlerResult {
  const isNodeSelectedRef = useLatest(isNodeSelected);
  const rootNodesRef = useLatest(rootNodes);

  const onVisibilityButtonClick = useCallback<VisibilityContext["onVisibilityButtonClick"]>(
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

function forEachSelectedNode(nodes: Array<TreeNode>, isNodeSelected: (nodeId: string) => boolean, callback: (node: TreeNode) => void) {
  nodes.forEach((node) => {
    if (isNodeSelected(node.id)) {
      callback(node);
    }
    if (node.isExpanded && typeof node.children !== "boolean") {
      forEachSelectedNode(node.children, isNodeSelected, callback);
    }
  });
}
