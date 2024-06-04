/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import { useCallback } from "react";

interface UseDoubleClickHandlerProps {
  onNodeClick: (node: PresentationHierarchyNode, isSelected: boolean, event: React.MouseEvent<HTMLElement, MouseEvent>) => void;
  onNodeDoubleClick?: (node: PresentationHierarchyNode) => void;
}

interface UseDoubleClickHandlerResult {
  onNodeClick: (node: PresentationHierarchyNode, isSelected: boolean, event: React.MouseEvent<HTMLElement, MouseEvent>) => void;
}

/** @internal */
export function useDoubleClickHandler({ onNodeClick, onNodeDoubleClick }: UseDoubleClickHandlerProps): UseDoubleClickHandlerResult {
  return {
    onNodeClick: useCallback(
      (node: PresentationHierarchyNode, isSelected: boolean, event: React.MouseEvent<HTMLElement, MouseEvent>) => {
        if (onNodeDoubleClick && event.detail === 2) {
          return onNodeDoubleClick(node);
        }
        return onNodeClick(node, isSelected, event);
      },
      [onNodeClick, onNodeDoubleClick],
    ),
  };
}
