/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { PresentationHierarchyNode, PresentationTreeNode, isPresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import { useEffect, useRef } from "react";

interface UseMultiCheckboxHandlerProps {
  rootNodes: PresentationTreeNode[] | undefined;
  isNodeSelected: (nodeId: string) => boolean;
  onClick: (node: PresentationHierarchyNode, checked: boolean) => void;
}

interface UseMultiCheckboxHandlerResult {
  onCheckboxClicked: (node: PresentationHierarchyNode, checked: boolean) => void;
}

/** @internal */
export function useMultiCheckboxHandler(props: UseMultiCheckboxHandlerProps): UseMultiCheckboxHandlerResult {
  const { rootNodes, isNodeSelected, onClick } = props;
  const rootNodesRef = useLatest(rootNodes);
  const isNodeSelectedRef = useLatest(isNodeSelected);
  const onClickRef = useLatest(onClick);

  const clickSelectedNodes = (nodes: Array<PresentationTreeNode>, checked: boolean) => {
    nodes.forEach((node) => {
      if (!isPresentationHierarchyNode(node)) {
        return;
      }
      if (isNodeSelectedRef.current(node.id)) {
        onClickRef.current(node, checked);
      }
      if (node.isExpanded && typeof node.children !== "boolean") {
        clickSelectedNodes(node.children, checked);
      }
    });
  };

  const onCheckboxClicked = (node: PresentationHierarchyNode, checked: boolean) => {
    if (!isNodeSelectedRef.current(node.id)) {
      onClickRef.current(node, checked);
      return;
    }
    rootNodesRef.current && clickSelectedNodes(rootNodesRef.current, checked);
  };

  return { onCheckboxClicked };
}

export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}
