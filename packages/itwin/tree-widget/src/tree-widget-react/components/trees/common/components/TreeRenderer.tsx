/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useMemo } from "react";
import { FilterAction } from "@itwin/presentation-hierarchies-react";
import { BaseTreeRenderer } from "./BaseTreeRenderer.js";

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
  const nodeMenuActions = useMemo<BaseTreeRendererProps["getMenuActions"]>(
    () => (getMenuActions ? (actionsProps) => getMenuActions(actionsProps, props) : undefined),
    [getMenuActions, props],
  );
  const nodeContextMenuActions = useMemo<BaseTreeRendererProps["getContextMenuActions"]>(
    () => (getContextMenuActions ? (actionsProps) => getContextMenuActions(actionsProps, props) : undefined),
    [getContextMenuActions, props],
  );
  const nodeDecorations = useMemo<BaseTreeRendererProps["getDecorations"]>(
    () => (getDecorations ? (node) => getDecorations(node, props) : undefined),
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
