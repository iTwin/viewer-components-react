/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { PresentationHierarchyNode, PresentationTreeNode, isPresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";

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
  const clickSelectedNodes = (nodes: Array<PresentationTreeNode>, checked: boolean) => {
    nodes.forEach((node) => {
      if (!isPresentationHierarchyNode(node)) {
        return;
      }
      if (isNodeSelected(node.id)) {
        onClick(node, checked);
      }
      if (node.isExpanded && typeof node.children !== "boolean") {
        clickSelectedNodes(node.children, checked);
      }
    });
  };

  const onCheckboxClicked = (node: PresentationHierarchyNode, checked: boolean) => {
    if (!isNodeSelected(node.id)) {
      onClick(node, checked);
      return;
    }
    rootNodes && clickSelectedNodes(rootNodes, checked);
  };

  return { onCheckboxClicked };
}
