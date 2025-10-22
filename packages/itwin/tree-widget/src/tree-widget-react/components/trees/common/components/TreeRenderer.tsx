/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback } from "react";
import { FilterAction } from "@itwin/presentation-hierarchies-react";
import { BaseTreeRenderer } from "./BaseTreeRenderer.js";

import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { BaseTreeRendererProps } from "./BaseTreeRenderer.js";

/** @beta */
type TreeRendererProps = Omit<BaseTreeRendererProps, "getInlineActions" | "getMenuActions" | "getDecorations"> & {
  [Property in keyof Pick<BaseTreeRendererProps, "getInlineActions" | "getMenuActions" | "getDecorations">]?: (
    node: PresentationHierarchyNode,
    treeRendererProps: TreeRendererProps,
  ) => ReturnType<NonNullable<BaseTreeRendererProps[Property]>>;
};

/**
 * Default renderer for rendering tree data.
 * @beta
 */
export function TreeRenderer(props: TreeRendererProps) {
  const { getInlineActions, getMenuActions, getDecorations, getHierarchyLevelDetails, onFilterClick, ...restProps } = props;

  const nodeInlineActions = useCallback(
    (node: PresentationHierarchyNode) => {
      return getInlineActions
        ? getInlineActions(node, props)
        : [<FilterAction key={"Filter"} node={node} onFilter={onFilterClick} getHierarchyLevelDetails={getHierarchyLevelDetails} reserveSpace />];
    },
    [getInlineActions, onFilterClick, getHierarchyLevelDetails, props],
  );
  const nodeMenuActions = useCallback((node: PresentationHierarchyNode) => (getMenuActions ? getMenuActions(node, props) : []), [getMenuActions, props]);
  const nodeDecorations = useCallback((node: PresentationHierarchyNode) => (getDecorations ? getDecorations(node, props) : []), [getDecorations, props]);

  return (
    <BaseTreeRenderer
      {...restProps}
      onFilterClick={onFilterClick}
      getHierarchyLevelDetails={getHierarchyLevelDetails}
      getInlineActions={nodeInlineActions}
      getMenuActions={nodeMenuActions}
      getDecorations={nodeDecorations}
    />
  );
}
