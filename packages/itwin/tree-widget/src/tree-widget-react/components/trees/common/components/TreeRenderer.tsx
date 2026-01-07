/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback } from "react";
import { FilterAction } from "@itwin/presentation-hierarchies-react";
import { BaseTreeRenderer } from "./BaseTreeRenderer.js";

import type { BaseTreeRendererProps } from "./BaseTreeRenderer.js";
import type { CallbacksWithCommonProps } from "./Tree.js";

/** @beta */
export type TreeRendererProps = BaseTreeRendererProps;

/** @beta */
export type ExtendedTreeRendererProps = CallbacksWithCommonProps<
  TreeRendererProps,
  "getInlineActions" | "getMenuActions" | "getContextMenuActions" | "getTreeItemProps"
>;

/**
 * Default renderer for rendering tree data.
 * @beta
 */
export function TreeRenderer(props: TreeRendererProps) {
  const { getInlineActions, getHierarchyLevelDetails, onFilterClick, ...restProps } = props;

  const nodeInlineActions = useCallback<Required<BaseTreeRendererProps>["getInlineActions"]>(
    (actionsProps) => {
      return getInlineActions
        ? getInlineActions(actionsProps)
        : [<FilterAction key={"Filter"} node={actionsProps.targetNode} onFilter={onFilterClick} getHierarchyLevelDetails={getHierarchyLevelDetails} />];
    },
    [getInlineActions, onFilterClick, getHierarchyLevelDetails],
  );

  return (
    <BaseTreeRenderer {...restProps} onFilterClick={onFilterClick} getHierarchyLevelDetails={getHierarchyLevelDetails} getInlineActions={nodeInlineActions} />
  );
}
