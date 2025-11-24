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
type TreeRendererProps = Omit<BaseTreeRendererProps, "getInlineActions" | "getMenuActions" | "getContextMenuActions" | "getDecorations"> & {
  [Property in keyof Pick<BaseTreeRendererProps, "getInlineActions" | "getMenuActions" | "getContextMenuActions" | "getDecorations">]?: (
    args: Parameters<NonNullable<BaseTreeRendererProps[Property]>>[0],
    treeRendererProps: TreeRendererProps,
  ) => ReturnType<NonNullable<BaseTreeRendererProps[Property]>>;
};

/**
 * Default renderer for rendering tree data.
 * @beta
 */
export function TreeRenderer(props: TreeRendererProps) {
  const { getInlineActions, getMenuActions, getContextMenuActions, getDecorations, getHierarchyLevelDetails, onFilterClick, ...restProps } = props;

  const nodeInlineActions = useCallback<Required<BaseTreeRendererProps>["getInlineActions"]>(
    (actionsProps) => {
      return getInlineActions
        ? getInlineActions(actionsProps, props)
        : [<FilterAction key={"Filter"} node={actionsProps.targetNode} onFilter={onFilterClick} getHierarchyLevelDetails={getHierarchyLevelDetails} />];
    },
    [getInlineActions, onFilterClick, getHierarchyLevelDetails, props],
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
    <BaseTreeRenderer
      {...restProps}
      onFilterClick={onFilterClick}
      getHierarchyLevelDetails={getHierarchyLevelDetails}
      getInlineActions={nodeInlineActions}
      getMenuActions={nodeMenuActions}
      getContextMenuActions={nodeContextMenuActions}
      getDecorations={nodeDecorations}
    />
  );
}
