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
export type VisibilityTreeRendererProps = Omit<BaseTreeRendererProps, "getInlineActions" | "getMenuActions" | "getDecorations"> & {
  [Property in keyof Pick<BaseTreeRendererProps, "getInlineActions" | "getMenuActions" | "getDecorations">]?: (
    node: PresentationHierarchyNode,
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
    getDecorations,
    onFilterClick,
    getHierarchyLevelDetails,
    ...restProps
  } = props;
  const { onVisibilityButtonClick } = useVisibilityButtonHandler({ rootNodes: props.rootNodes, isNodeSelected: props.isNodeSelected, onClick });

  const nodeInlineActions = useCallback(
    (node: PresentationHierarchyNode) => {
      return getInlineActions
        ? getInlineActions(node, props)
        : [
            <VisibilityAction key={"Visibility"} node={node} reserveSpace />,
            <FilterAction key={"Filter"} node={node} onFilter={onFilterClick} getHierarchyLevelDetails={getHierarchyLevelDetails} reserveSpace />,
          ];
    },
    [onFilterClick, getHierarchyLevelDetails, getInlineActions, props],
  );
  const nodeMenuActions = useCallback((node: PresentationHierarchyNode) => (getMenuActions ? getMenuActions(node, props) : []), [getMenuActions, props]);
  const nodeDecorations = useCallback((node: PresentationHierarchyNode) => (getDecorations ? getDecorations(node, props) : []), [getDecorations, props]);

  return (
    <VisibilityContextProvider onVisibilityButtonClick={onVisibilityButtonClick} getVisibilityButtonState={getVisibilityButtonState}>
      <BaseTreeRenderer
        {...restProps}
        onFilterClick={onFilterClick}
        getHierarchyLevelDetails={getHierarchyLevelDetails}
        getInlineActions={nodeInlineActions}
        getMenuActions={nodeMenuActions}
        getDecorations={nodeDecorations}
      />
    </VisibilityContextProvider>
  );
}
