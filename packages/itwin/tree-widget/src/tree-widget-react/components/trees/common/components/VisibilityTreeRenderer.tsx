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
export type VisibilityTreeRendererProps = Omit<BaseTreeRendererProps, "getInlineActions" | "getMenuActions" | "getContextMenuActions" | "getDecorations"> & {
  [Property in keyof Pick<BaseTreeRendererProps, "getInlineActions" | "getMenuActions" | "getContextMenuActions" | "getDecorations">]?: (
    args: Parameters<NonNullable<BaseTreeRendererProps[Property]>>[0],
    treeRendererProps: VisibilityTreeRendererProps,
  ) => ReturnType<NonNullable<BaseTreeRendererProps[Property]>>;
} & VisibilityContext;

/**
 * Tree renderer that renders tree nodes with eye checkboxes for controlling visibility of instances represented by tree nodes.
 * @beta
 */
export function VisibilityTreeRenderer(props: VisibilityTreeRendererProps) {
  const {
    getVisibilityButtonState,
    onVisibilityButtonClick: onClick,
    getInlineActions,
    getMenuActions,
    getContextMenuActions,
    getDecorations,
    onFilterClick,
    getHierarchyLevelDetails,
    ...restProps
  } = props;
  const { onVisibilityButtonClick } = useVisibilityButtonHandler({ rootNodes: props.rootNodes, isNodeSelected: props.isNodeSelected, onClick });

  const nodeInlineActions = useCallback<Required<BaseTreeRendererProps>["getInlineActions"]>(
    (actionsProps) => {
      return getInlineActions
        ? getInlineActions(actionsProps, props)
        : [
            <VisibilityAction key={"Visibility"} node={actionsProps.targetNode} />,
            <FilterAction key={"Filter"} node={actionsProps.targetNode} onFilter={onFilterClick} getHierarchyLevelDetails={getHierarchyLevelDetails} />,
          ];
    },
    [onFilterClick, getHierarchyLevelDetails, getInlineActions, props],
  );
  const nodeMenuActions = useCallback<Required<BaseTreeRendererProps>["getMenuActions"]>(
    (actionsProps) => (getMenuActions ? getMenuActions(actionsProps, props) : []),
    [getMenuActions, props],
  );
  const nodeContextMenuActions = useCallback<Required<BaseTreeRendererProps>["getContextMenuActions"]>(
    (actionsProps) => (getContextMenuActions ? getContextMenuActions(actionsProps, props) : []),
    [getContextMenuActions, props],
  );
  const nodeDecorations = useCallback<Required<BaseTreeRendererProps>["getDecorations"]>(
    (node: PresentationHierarchyNode) => (getDecorations ? getDecorations(node, props) : []),
    [getDecorations, props],
  );

  return (
    <VisibilityContextProvider onVisibilityButtonClick={onVisibilityButtonClick} getVisibilityButtonState={getVisibilityButtonState}>
      <BaseTreeRenderer
        {...restProps}
        onFilterClick={onFilterClick}
        getHierarchyLevelDetails={getHierarchyLevelDetails}
        getInlineActions={nodeInlineActions}
        getMenuActions={nodeMenuActions}
        getContextMenuActions={nodeContextMenuActions}
        getDecorations={nodeDecorations}
      />
    </VisibilityContextProvider>
  );
}
