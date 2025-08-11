/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback } from "react";
import { FilterAction } from "@itwin/presentation-hierarchies-react";
import { BaseTreeRenderer } from "./BaseTreeRenderer.js";
import { VisibilityAction, VisibilityContextProvider } from "./TreeNodeVisibilityButton.js";
import { useVisibilityButtonHandler } from "./UseVisibilityButtonHandler.js";

import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { BaseTreeRendererProps } from "./BaseTreeRenderer.js";
import type { VisibilityContext } from "./TreeNodeVisibilityButton.js";

/** @beta */
export type VisibilityTreeRendererProps = BaseTreeRendererProps & VisibilityContext;

/**
 * Tree renderer that renders tree nodes with eye checkboxes for controlling visibility of instances represented by tree nodes.
 * @beta
 */
export function VisibilityTreeRenderer({
  getVisibilityButtonState,
  onVisibilityButtonClick: onClick,
  getInlineActions,
  onFilterClick,
  getHierarchyLevelDetails,
  ...props
}: VisibilityTreeRendererProps) {
  const { onVisibilityButtonClick } = useVisibilityButtonHandler({ rootNodes: props.rootNodes, isNodeSelected: props.isNodeSelected, onClick });

  const nodeActions = useCallback(
    (node: PresentationHierarchyNode) => {
      return getInlineActions
        ? getInlineActions(node)
        : [
            <VisibilityAction key={"Visibility"} node={node} reserveSpace />,
            <FilterAction key={"Filter"} node={node} onFilter={onFilterClick} getHierarchyLevelDetails={getHierarchyLevelDetails} reserveSpace />,
          ];
    },
    [onFilterClick, getHierarchyLevelDetails, getInlineActions],
  );

  return (
    <VisibilityContextProvider onVisibilityButtonClick={onVisibilityButtonClick} getVisibilityButtonState={getVisibilityButtonState}>
      <BaseTreeRenderer {...props} onFilterClick={onFilterClick} getHierarchyLevelDetails={getHierarchyLevelDetails} getInlineActions={nodeActions} />
    </VisibilityContextProvider>
  );
}
