/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { VisibilityTree } from "../common/components/VisibilityTree.js";
import { VisibilityTreeRenderer } from "../common/components/VisibilityTreeRenderer.js";
import { useClassificationsTree } from "./UseClassificationsTree.js";

import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";
import type { VisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer.js";
import type { UseClassificationsTreeProps } from "./UseClassificationsTree.js";

/** @alpha */
export type ClassificationsTreeProps = Pick<VisibilityTreeProps, "imodel" | "selectionStorage" | "selectionMode" | "emptyTreeContent"> &
  Pick<VisibilityTreeRendererProps, "getInlineActions" | "getMenuActions" | "getContextMenuActions" | "getDecorations" | "getEditingProps" | "treeLabel"> &
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
  getDecorations,
  getInlineActions,
  getMenuActions,
  getContextMenuActions,
  getEditingProps,
  searchText,
  treeLabel,
}: ClassificationsTreeProps) {
  const { classificationsTreeProps, rendererProps } = useClassificationsTree({
    activeView,
    hierarchyConfig,
    emptyTreeContent,
    searchText,
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
          {...rendererProps}
          treeLabel={treeLabel}
          getEditingProps={getEditingProps}
          getInlineActions={getInlineActions}
          getMenuActions={getMenuActions}
          getContextMenuActions={getContextMenuActions}
          getDecorations={getDecorations ?? rendererProps.getDecorations}
        />
      )}
    />
  );
}
