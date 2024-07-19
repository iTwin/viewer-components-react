/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { VisibilityTree } from "../common/components/VisibilityTree";
import { VisibilityTreeRenderer } from "../common/components/VisibilityTreeRenderer";
import { useCategoriesTree } from "./UseCategoriesTree";

import type { ComponentPropsWithoutRef } from "react";
import type { Viewport } from "@itwin/core-frontend";

/** @beta */
interface CategoriesTreeOwnProps {
  filter: string;
  activeView: Viewport;
  hierarchyLevelConfig?: {
    sizeLimit?: number;
  };
}

/** @beta */
type VisibilityTreeProps = ComponentPropsWithoutRef<typeof VisibilityTree>;

/** @beta */
type CategoriesTreeProps = CategoriesTreeOwnProps & Pick<VisibilityTreeProps, "imodel" | "getSchemaContext" | "selectionStorage" | "density" | "selectionMode">;

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
}: CategoriesTreeProps) {
  const { categoriesTreeProps, rendererProps } = useCategoriesTree({
    filter,
    activeView,
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
