/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback } from "react";
import { FilterAction } from "@itwin/presentation-hierarchies-react";
import { BaseTreeRenderer } from "./BaseTreeRenderer.js";
import { VisibilityAction } from "./TreeNodeVisibilityButton.js";
import { useVisibilityButtonHandler } from "./UseVisibilityButtonHandler.js";

import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { BaseTreeRendererProps } from "./BaseTreeRenderer.js";
import type { TreeItemVisibilityButtonProps } from "./TreeNodeVisibilityButton.js";

/** @beta */
export type VisibilityTreeRendererProps = BaseTreeRendererProps & TreeItemVisibilityButtonProps;

/**
 * Tree renderer that renders tree nodes with eye checkboxes for controlling visibility of instances represented by tree nodes.
 * @beta
 */
export function VisibilityTreeRenderer({
  getVisibilityButtonState,
  onVisibilityButtonClick: onClick,
  getInlineActions,
  getMenuActions,
  onFilterClick,
  getHierarchyLevelDetails,
  ...props
}: VisibilityTreeRendererProps) {
  const { onVisibilityButtonClick } = useVisibilityButtonHandler({ rootNodes: props.rootNodes, isNodeSelected: props.isNodeSelected, onClick });

  const nodeInlineActions = useCallback(
    (node: PresentationHierarchyNode) => {
      return getInlineActions
        ? getInlineActions(node)
        : [
            <VisibilityAction
              key={"Visibility"}
              node={node}
              onVisibilityButtonClick={onVisibilityButtonClick}
              getVisibilityButtonState={getVisibilityButtonState}
              reserveSpace
            />,
            <FilterAction key={"Filter"} node={node} onFilter={onFilterClick} getHierarchyLevelDetails={getHierarchyLevelDetails} reserveSpace />,
          ];
    },
    [getInlineActions, onVisibilityButtonClick, getVisibilityButtonState, onFilterClick, getHierarchyLevelDetails],
  );

  return (
    <BaseTreeRenderer
      {...props}
      onFilterClick={onFilterClick}
      getHierarchyLevelDetails={getHierarchyLevelDetails}
      getInlineActions={nodeInlineActions}
      getMenuActions={getMenuActions}
    />
  );
}
