/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { VisibilityTree } from "../common/components/VisibilityTree.js";
import { VisibilityTreeRenderer } from "../common/components/VisibilityTreeRenderer.js";
import { useModelsTree } from "./UseModelsTree.js";

import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";
import type { VisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer.js";
import type { UseModelsTreeProps } from "./UseModelsTree.js";

/** @beta */
export type ModelsTreeProps = Pick<VisibilityTreeProps, "imodel" | "selectionStorage" | "selectionMode" | "emptyTreeContent"> &
  Pick<VisibilityTreeRendererProps, "getInlineActions" | "getMenuActions" | "getContextMenuActions" | "getDecorations" | "treeLabel"> &
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
  getContextMenuActions,
  emptyTreeContent,
  getSubTreePaths,
  treeLabel,
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
          treeLabel={treeLabel}
          getInlineActions={getInlineActions}
          getMenuActions={getMenuActions}
          getContextMenuActions={getContextMenuActions}
          getDecorations={getDecorations ?? rendererProps.getDecorations}
        />
      )}
    />
  );
}
