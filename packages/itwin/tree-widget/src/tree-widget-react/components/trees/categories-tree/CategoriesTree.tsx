/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { VisibilityTree } from "../common/components/VisibilityTree.js";
import { VisibilityTreeRenderer } from "../common/components/VisibilityTreeRenderer.js";
import { useCategoriesTree } from "./UseCategoriesTree.js";

import type { VisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer.js";
import type { UseCategoriesTreeProps } from "./UseCategoriesTree.js";
import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";

/** @beta */
export type CategoriesTreeProps = Pick<VisibilityTreeProps, "imodel" | "getSchemaContext" | "selectionStorage" | "selectionMode" | "emptyTreeContent"> &
  Pick<VisibilityTreeRendererProps, "getActions" | "getDecorations"> &
  UseCategoriesTreeProps & {
    hierarchyLevelConfig?: {
      sizeLimit?: number;
    };
  };

/** @beta */
export function CategoriesTree({
  imodel,
  getSchemaContext,
  selectionStorage,
  activeView,
  filter,
  hierarchyLevelConfig,
  selectionMode,
  onCategoriesFiltered,
  emptyTreeContent,
  getDecorations,
  getActions,
  hierarchyConfig,
}: CategoriesTreeProps) {
  const { categoriesTreeProps, rendererProps } = useCategoriesTree({
    filter,
    activeView,
    onCategoriesFiltered,
    emptyTreeContent,
    hierarchyConfig,
  });

  return (
    <VisibilityTree
      {...categoriesTreeProps}
      imodel={imodel}
      selectionStorage={selectionStorage}
      getSchemaContext={getSchemaContext}
      hierarchyLevelSizeLimit={hierarchyLevelConfig?.sizeLimit}
      selectionMode={selectionMode ?? "none"}
      treeRenderer={(treeProps) => (
        <VisibilityTreeRenderer {...treeProps} {...rendererProps} getActions={getActions} getDecorations={getDecorations ?? rendererProps.getDecorations} />
      )}
    />
  );
}
