/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useRef } from "react";
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
  const rootNodesRef = useRef(rootNodes);

  useEffect(() => {
    rootNodesRef.current = rootNodes;
  }, [rootNodes]);

  const clickSelectedNodes = useCallback(
    (nodes: Array<PresentationTreeNode>, checked: boolean) => {
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
    },
    [isNodeSelected, onClick],
  );

  const onCheckboxClicked = useCallback(
    (node: PresentationHierarchyNode, checked: boolean) => {
      if (!isNodeSelected(node.id)) {
        onClick(node, checked);
        return;
      }
      rootNodesRef.current && clickSelectedNodes(rootNodesRef.current, checked);
    },
    [rootNodesRef, clickSelectedNodes, isNodeSelected, onClick],
  );

  return { onCheckboxClicked };
}
