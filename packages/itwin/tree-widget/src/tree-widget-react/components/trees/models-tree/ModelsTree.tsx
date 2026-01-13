/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { VisibilityTree } from "../common/components/VisibilityTree.js";
import { VisibilityTreeRenderer } from "../common/components/VisibilityTreeRenderer.js";
import { useModelsTree } from "./UseModelsTree.js";

import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";
import type { ExtendedVisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer.js";
import type { UseModelsTreeProps } from "./UseModelsTree.js";

/** @beta */
export type ModelsTreeProps = Pick<
  ExtendedVisibilityTreeRendererProps,
  "getInlineActions" | "getMenuActions" | "getContextMenuActions" | "getTreeItemProps" | "treeLabel"
> &
  Pick<VisibilityTreeProps, "imodel" | "selectionStorage" | "selectionMode" | "emptyTreeContent"> &
  UseModelsTreeProps & {
    hierarchyLevelConfig?: {
      sizeLimit?: number;
    };
  };

/** @beta */
export function ModelsTree({
  imodel,
  selectionStorage,
  activeView,
  searchText,
  hierarchyLevelConfig,
  hierarchyConfig,
  selectionMode,
  selectionPredicate,
  visibilityHandlerOverrides,
  getSearchPaths,
  onModelsFiltered,
  getInlineActions,
  getMenuActions,
  getContextMenuActions,
  emptyTreeContent,
  getSubTreePaths,
  getTreeItemProps,
  treeLabel,
}: ModelsTreeProps) {
  const modelsTree = useModelsTree({
    activeView,
    searchText,
    hierarchyConfig,
    visibilityHandlerOverrides,
    getSearchPaths,
    onModelsFiltered,
    selectionPredicate,
    emptyTreeContent,
    getSubTreePaths,
    getTreeItemProps,
  });

  return (
    <VisibilityTree
      {...modelsTree.treeProps}
      imodel={imodel}
      selectionStorage={selectionStorage}
      hierarchyLevelSizeLimit={hierarchyLevelConfig?.sizeLimit}
      selectionMode={selectionMode}
      treeRenderer={(treeProps) => (
        <VisibilityTreeRenderer
          {...treeProps}
          treeLabel={treeLabel}
          getInlineActions={getInlineActions ? (node) => getInlineActions(node, treeProps) : undefined}
          getMenuActions={getMenuActions ? (node) => getMenuActions(node, treeProps) : undefined}
          getContextMenuActions={getContextMenuActions ? (node) => getContextMenuActions(node, treeProps) : undefined}
          getTreeItemProps={(node) => modelsTree.getTreeItemProps(node, treeProps)}
        />
      )}
    />
  );
}
