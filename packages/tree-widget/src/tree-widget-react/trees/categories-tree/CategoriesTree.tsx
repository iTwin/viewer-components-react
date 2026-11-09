/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { VisibilityTree } from "../../shared/components/VisibilityTree.js";
import { VisibilityTreeRenderer } from "../../shared/components/VisibilityTreeRenderer.js";
import { useCategoriesTree } from "./UseCategoriesTree.js";

import type { VisibilityTreeProps } from "../../shared/components/VisibilityTree.js";
import type { ExtendedVisibilityTreeRendererProps } from "../../shared/components/VisibilityTreeRenderer.js";
import type { UseCategoriesTreeProps } from "./UseCategoriesTree.js";

/** @beta */
export type CategoriesTreeProps = Pick<
  ExtendedVisibilityTreeRendererProps,
  "getInlineActions" | "getMenuActions" | "getContextMenuActions" | "getTreeItemProps" | "treeLabel"
> &
  Pick<VisibilityTreeProps, "imodel" | "selectionStorage" | "selectionMode" | "emptyTreeContent"> &
  UseCategoriesTreeProps & {
    hierarchyLevelConfig?: {
      sizeLimit?: number;
    };
  };

/**
 * Requires `TreeWidgetContextProvider` to be present in component above.
 * @beta
 */
export function CategoriesTree({
  imodel,
  selectionStorage,
  activeView,
  searchText,
  hierarchyLevelConfig,
  hierarchyConfig,
  selectionMode,
  onCategoriesFiltered,
  emptyTreeContent,
  getInlineActions,
  getMenuActions,
  getContextMenuActions,
  getTreeItemProps,
  treeLabel,
}: CategoriesTreeProps) {
  const categoriesTree = useCategoriesTree({
    searchText,
    activeView,
    onCategoriesFiltered,
    emptyTreeContent,
    hierarchyConfig,
    getTreeItemProps,
  });

  return (
    <VisibilityTree
      {...categoriesTree.treeProps}
      imodel={imodel}
      selectionStorage={selectionStorage}
      hierarchyLevelSizeLimit={hierarchyLevelConfig?.sizeLimit}
      selectionMode={selectionMode ?? "none"}
      treeRenderer={(treeProps) => (
        <VisibilityTreeRenderer
          {...treeProps}
          treeLabel={treeLabel}
          getInlineActions={getInlineActions ? (node) => getInlineActions(node, treeProps) : undefined}
          getMenuActions={getMenuActions ? (node) => getMenuActions(node, treeProps) : undefined}
          getContextMenuActions={getContextMenuActions ? (node) => getContextMenuActions(node, treeProps) : undefined}
          getTreeItemProps={(node) => categoriesTree.getTreeItemProps(node, treeProps)}
        />
      )}
    />
  );
}
