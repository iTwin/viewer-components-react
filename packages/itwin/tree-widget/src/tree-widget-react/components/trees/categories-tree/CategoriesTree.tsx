/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { VisibilityTree } from "../common/components/VisibilityTree.js";
import { VisibilityTreeRenderer } from "../common/components/VisibilityTreeRenderer.js";
import { useCategoriesTree } from "./UseCategoriesTree.js";

import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";
import type { UseCategoriesTreeProps } from "./UseCategoriesTree.js";

/** @beta */
export type CategoriesTreeProps = Pick<VisibilityTreeProps, "imodel" | "getSchemaContext" | "selectionStorage" | "density" | "selectionMode"> &
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
  density,
  hierarchyLevelConfig,
  hierarchyConfig,
  selectionMode,
  onCategoriesFiltered,
}: CategoriesTreeProps) {
  const { categoriesTreeProps, rendererProps } = useCategoriesTree({
    filter,
    activeView,
    onCategoriesFiltered,
    hierarchyConfig,
  });

  return (
    <VisibilityTree
      {...categoriesTreeProps}
      imodel={imodel}
      selectionStorage={selectionStorage}
      getSchemaContext={getSchemaContext}
      hierarchyLevelSizeLimit={hierarchyLevelConfig?.sizeLimit}
      density={density}
      selectionMode={selectionMode ?? "none"}
      treeRenderer={(treeProps) => <VisibilityTreeRenderer {...treeProps} {...rendererProps} />}
    />
  );
}
