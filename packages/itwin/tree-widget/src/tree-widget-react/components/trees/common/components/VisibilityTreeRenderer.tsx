/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback } from "react";
import { FilterAction } from "@itwin/presentation-hierarchies-react";
import { BaseTreeRenderer } from "./BaseTreeRenderer.js";
import { VisibilityAction, VisibilityContextProvider } from "./TreeNodeVisibilityButton.js";
import { useVisibilityButtonHandler } from "./UseVisibilityButtonHandler.js";

import type { BaseTreeRendererProps } from "./BaseTreeRenderer.js";
import type { CallbacksWithCommonProps } from "./Tree.js";
import type { VisibilityContext } from "./TreeNodeVisibilityButton.js";

/** @beta */
export type VisibilityTreeRendererProps = BaseTreeRendererProps & VisibilityContext;

/** @beta */
export type ExtendedVisibilityTreeRendererProps = CallbacksWithCommonProps<
  VisibilityTreeRendererProps,
  "getInlineActions" | "getMenuActions" | "getContextMenuActions" | "getTreeItemProps"
>;

/**
 * Tree renderer that renders tree nodes with eye checkboxes for controlling visibility of instances represented by tree nodes.
 * @beta
 */
export function VisibilityTreeRenderer(props: VisibilityTreeRendererProps) {
  const { getVisibilityButtonState, onVisibilityButtonClick: onClick, getInlineActions, onFilterClick, getHierarchyLevelDetails, ...restProps } = props;
  const { onVisibilityButtonClick } = useVisibilityButtonHandler({ rootNodes: props.rootNodes, isNodeSelected: props.isNodeSelected, onClick });

  const nodeInlineActions = useCallback<Required<BaseTreeRendererProps>["getInlineActions"]>(
    (actionsProps) => {
      return getInlineActions
        ? getInlineActions(actionsProps)
        : [
            <VisibilityAction key={"Visibility"} node={actionsProps.targetNode} />,
            <FilterAction key={"Filter"} node={actionsProps.targetNode} onFilter={onFilterClick} getHierarchyLevelDetails={getHierarchyLevelDetails} />,
          ];
    },
    [onFilterClick, getHierarchyLevelDetails, getInlineActions],
  );

  return (
    <VisibilityContextProvider onVisibilityButtonClick={onVisibilityButtonClick} getVisibilityButtonState={getVisibilityButtonState}>
      <BaseTreeRenderer {...restProps} onFilterClick={onFilterClick} getHierarchyLevelDetails={getHierarchyLevelDetails} getInlineActions={nodeInlineActions} />
    </VisibilityContextProvider>
  );
}
