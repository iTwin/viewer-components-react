/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { VisibilityTree } from "../common/components/VisibilityTree.js";
import { VisibilityTreeRenderer } from "../common/components/VisibilityTreeRenderer.js";
import { useClassificationsTree } from "./UseClassificationsTree.js";

import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";
import type { ExtendedVisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer.js";
import type { UseClassificationsTreeProps } from "./UseClassificationsTree.js";

/** @alpha */
export type ClassificationsTreeProps = Pick<
  ExtendedVisibilityTreeRendererProps,
  "getInlineActions" | "getMenuActions" | "getContextMenuActions" | "getTreeItemProps" | "getEditingProps" | "treeLabel"
> &
  Pick<VisibilityTreeProps, "imodel" | "selectionStorage" | "selectionMode" | "emptyTreeContent"> &
  UseClassificationsTreeProps & {
    hierarchyLevelConfig?: {
      sizeLimit?: number;
    };
  };

/** @alpha */
export function ClassificationsTree({
  imodel,
  selectionStorage,
  activeView,
  hierarchyConfig,
  hierarchyLevelConfig,
  selectionMode,
  emptyTreeContent,
  getTreeItemProps,
  getInlineActions,
  getMenuActions,
  getContextMenuActions,
  getEditingProps,
  searchText,
  treeLabel,
}: ClassificationsTreeProps) {
  const { classificationsTreeProps, getTreeItemProps: classificationsTreeItemProps } = useClassificationsTree({
    activeView,
    hierarchyConfig,
    emptyTreeContent,
    searchText,
    getTreeItemProps,
  });

  return (
    <VisibilityTree
      {...classificationsTreeProps}
      imodel={imodel}
      selectionStorage={selectionStorage}
      hierarchyLevelSizeLimit={hierarchyLevelConfig?.sizeLimit}
      selectionMode={selectionMode ?? "none"}
      treeRenderer={(treeProps) => (
        <VisibilityTreeRenderer
          {...treeProps}
          treeLabel={treeLabel}
          getEditingProps={getEditingProps}
          getInlineActions={getInlineActions ? (node) => getInlineActions(node, treeProps) : undefined}
          getMenuActions={getMenuActions ? (node) => getMenuActions(node, treeProps) : undefined}
          getContextMenuActions={getContextMenuActions ? (node) => getContextMenuActions(node, treeProps) : undefined}
          getTreeItemProps={(node) => classificationsTreeItemProps(node, treeProps)}
        />
      )}
    />
  );
}
