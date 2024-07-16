/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { VisibilityTree } from "../common/components/VisibilityTree";
import { VisibilityTreeRenderer } from "../common/components/VisibilityTreeRenderer";
import { useCategoriesTree } from "./UseCategoriesTree";

import type { ComponentPropsWithoutRef } from "react";
import type { ViewManager, Viewport } from "@itwin/core-frontend";

/** @beta */
interface CategoriesTreeOwnProps {
  filter: string;
  activeView: Viewport;
  viewManager?: ViewManager;
  allViewports?: boolean;
  hierarchyLevelConfig?: {
    sizeLimit?: number;
  };
}

/** @beta */
type VisibilityTreeProps = ComponentPropsWithoutRef<typeof VisibilityTree>;

/** @beta */
type CategoriesTreeProps = CategoriesTreeOwnProps &
  Pick<VisibilityTreeProps, "imodel" | "getSchemaContext" | "selectionStorage" | "height" | "width" | "density" | "selectionMode">;

/** @beta */
export function CategoriesTree({
  imodel,
  viewManager,
  allViewports,
  getSchemaContext,
  selectionStorage,
  height,
  width,
  activeView,
  filter,
  density,
  hierarchyLevelConfig,
  selectionMode,
}: CategoriesTreeProps) {
  const { categoriesTreeProps, rendererProps } = useCategoriesTree({
    imodel,
    filter,
    activeView,
    viewManager,
    allViewports,
  });

  return (
    <VisibilityTree
      {...categoriesTreeProps}
      height={height}
      width={width}
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
