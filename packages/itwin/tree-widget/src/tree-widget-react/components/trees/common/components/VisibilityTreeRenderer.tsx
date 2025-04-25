/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @itwin/no-internal */

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
  getActions,
  onFilterClick,
  getHierarchyLevelDetails,
  ...props
}: VisibilityTreeRendererProps) {
  const { onVisibilityButtonClick } = useVisibilityButtonHandler({ rootNodes: props.rootNodes, isNodeSelected: props.isNodeSelected, onClick });

  const nodeActions = useCallback(
    (node: PresentationHierarchyNode) => {
      return [
        <VisibilityAction
          key={"Visibility"}
          node={node}
          onVisibilityButtonClick={onVisibilityButtonClick}
          getVisibilityButtonState={getVisibilityButtonState}
        />,
        <FilterAction key={"Filter"} node={node} onFilter={onFilterClick} getHierarchyLevelDetails={getHierarchyLevelDetails} />,
        ...(getActions ? getActions(node) : []),
      ];
    },
    [onVisibilityButtonClick, getVisibilityButtonState, onFilterClick, getHierarchyLevelDetails, getActions],
  );

  return <BaseTreeRenderer {...props} onFilterClick={onFilterClick} getHierarchyLevelDetails={getHierarchyLevelDetails} getActions={nodeActions} />;
}
