/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback } from "react";
import { isPresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";

import type { PresentationHierarchyNode, PresentationTreeNode } from "@itwin/presentation-hierarchies-react";

interface UseMultiCheckboxHandlerProps {
  rootNodes: PresentationTreeNode[] | undefined;
  isNodeSelected: (nodeId: string) => boolean;
  onClick: (node: PresentationHierarchyNode, checked: boolean) => void;
}

interface UseMultiCheckboxHandlerResult {
  onCheckboxClicked: (node: PresentationHierarchyNode, checked: boolean) => void;
}

/** @internal */
export function useMultiCheckboxHandler({ rootNodes, isNodeSelected, onClick }: UseMultiCheckboxHandlerProps): UseMultiCheckboxHandlerResult {
  const onCheckboxClicked = useCallback(
    (clickedNode: PresentationHierarchyNode, checked: boolean) => {
      if (!isNodeSelected(clickedNode.id)) {
        onClick(clickedNode, checked);
        return;
      }
      rootNodes && forEachSelectedNode(rootNodes, isNodeSelected, (node) => onClick(node, checked));
    },
    [rootNodes, isNodeSelected, onClick],
  );

  return { onCheckboxClicked };
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
