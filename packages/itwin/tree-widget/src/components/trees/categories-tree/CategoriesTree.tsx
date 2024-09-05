/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { VisibilityTree } from "../common/components/VisibilityTree";
import { VisibilityTreeRenderer } from "../common/components/VisibilityTreeRenderer";
import { useCategoriesTree } from "./UseCategoriesTree";

import type { ComponentPropsWithoutRef } from "react";

/** @beta */
interface CategoriesTreeOwnProps {
  hierarchyLevelConfig?: {
    sizeLimit?: number;
  };
}

type UseCategoriesTreeProps = Parameters<typeof useCategoriesTree>[0];

/** @beta */
type VisibilityTreeProps = ComponentPropsWithoutRef<typeof VisibilityTree>;

/** @beta */
type CategoriesTreeProps = CategoriesTreeOwnProps &
  UseCategoriesTreeProps &
  Pick<VisibilityTreeProps, "imodel" | "getSchemaContext" | "selectionStorage" | "density" | "selectionMode">;

/** @beta */
export function CategoriesTree({
  imodel,
  getSchemaContext,
  selectionStorage,
  activeView,
  filter,
  density,
  hierarchyLevelConfig,
  selectionMode,
  onCategoriesFiltered,
}: CategoriesTreeProps) {
  const { categoriesTreeProps, rendererProps } = useCategoriesTree({
    filter,
    activeView,
    onCategoriesFiltered,
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
