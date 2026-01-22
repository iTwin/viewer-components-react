/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback } from "react";
import { TreeNodeFilterAction } from "@itwin/presentation-hierarchies-react";
import { BaseTreeRenderer } from "./BaseTreeRenderer.js";

import type { BaseTreeRendererProps } from "./BaseTreeRenderer.js";
import type { CallbacksWithCommonTreeRendererProps } from "./Tree.js";

/** @beta */
export type TreeRendererProps = BaseTreeRendererProps;

/** @beta */
export type ExtendedTreeRendererProps = CallbacksWithCommonTreeRendererProps<
  TreeRendererProps,
  "getInlineActions" | "getMenuActions" | "getContextMenuActions" | "getTreeItemProps"
>;

/**
 * Default renderer for rendering tree data.
 * @beta
 */
export function TreeRenderer(props: TreeRendererProps) {
  const { getInlineActions, getHierarchyLevelDetails, filterHierarchyLevel, ...restProps } = props;

  const nodeInlineActions = useCallback<Required<BaseTreeRendererProps>["getInlineActions"]>(
    (actionsProps) => {
      return getInlineActions
        ? getInlineActions(actionsProps)
        : [<TreeNodeFilterAction key={"Filter"} node={actionsProps.targetNode} onFilter={filterHierarchyLevel} getHierarchyLevelDetails={getHierarchyLevelDetails} />];
    },
    [getInlineActions, filterHierarchyLevel, getHierarchyLevelDetails],
  );

  return (
    <BaseTreeRenderer {...restProps} filterHierarchyLevel={filterHierarchyLevel} getHierarchyLevelDetails={getHierarchyLevelDetails} getInlineActions={nodeInlineActions} />
  );
}
