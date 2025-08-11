/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { VisibilityTree } from "../common/components/VisibilityTree.js";
import { VisibilityTreeRenderer } from "../common/components/VisibilityTreeRenderer.js";
import { useModelsTree } from "./UseModelsTree.js";

import type { VisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer.js";
import type { UseModelsTreeProps } from "./UseModelsTree.js";
import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";

/** @beta */
export type ModelsTreeProps = Pick<VisibilityTreeProps, "imodel" | "selectionStorage" | "selectionMode" | "emptyTreeContent"> &
  Pick<VisibilityTreeRendererProps, "getInlineActions" | "getMenuActions" | "getDecorations"> &
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
  filter,
  hierarchyLevelConfig,
  hierarchyConfig,
  selectionMode,
  selectionPredicate,
  visibilityHandlerOverrides,
  getFilteredPaths,
  getDecorations,
  onModelsFiltered,
  getInlineActions,
  getMenuActions,
  emptyTreeContent,
  getSubTreePaths,
}: ModelsTreeProps) {
  const { modelsTreeProps, rendererProps } = useModelsTree({
    activeView,
    filter,
    hierarchyConfig,
    visibilityHandlerOverrides,
    getFilteredPaths,
    onModelsFiltered,
    selectionPredicate,
    emptyTreeContent,
    getSubTreePaths,
  });

  return (
    <VisibilityTree
      {...modelsTreeProps}
      imodel={imodel}
      selectionStorage={selectionStorage}
      hierarchyLevelSizeLimit={hierarchyLevelConfig?.sizeLimit}
      selectionMode={selectionMode}
      treeRenderer={(treeProps) => (
        <VisibilityTreeRenderer
          {...treeProps}
          {...rendererProps}
          getInlineActions={getInlineActions}
          getMenuActions={getMenuActions}
          getDecorations={getDecorations ?? rendererProps.getDecorations}
        />
      )}
    />
  );
}
