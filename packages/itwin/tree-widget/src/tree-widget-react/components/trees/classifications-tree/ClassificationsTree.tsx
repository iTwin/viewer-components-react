/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";
import { useCallback } from "react";
import { RenameAction } from "@itwin/presentation-hierarchies-react";
import { VisibilityTree } from "../common/components/VisibilityTree.js";
import { VisibilityTreeRenderer } from "../common/components/VisibilityTreeRenderer.js";
import { useClassificationsTree } from "./UseClassificationsTree.js";

import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { VisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer.js";
import type { UseClassificationsTreeProps } from "./UseClassificationsTree.js";

/** @alpha */
export type ClassificationsTreeProps = Pick<VisibilityTreeProps, "imodel" | "selectionStorage" | "selectionMode" | "emptyTreeContent"> &
  Pick<VisibilityTreeRendererProps, "getActions" | "getDecorations" | "getEditingProps"> &
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
  getActions,
  getEditingProps,
}: ClassificationsTreeProps) {
  const { categoriesTreeProps, rendererProps } = useClassificationsTree({
    activeView,
    hierarchyConfig,
    emptyTreeContent,
  });

  const nodeActions = useCallback(
    (node: PresentationHierarchyNode) => {
      return [<RenameAction key="RenameAction" />, ...(getActions ? getActions(node) : [])];
    },
    [getActions],
  );

  return (
    <VisibilityTree
      {...categoriesTreeProps}
      imodel={imodel}
      selectionStorage={selectionStorage}
      hierarchyLevelSizeLimit={hierarchyLevelConfig?.sizeLimit}
      selectionMode={selectionMode ?? "none"}
      treeRenderer={(treeProps) => (
        <VisibilityTreeRenderer
          {...treeProps}
          {...rendererProps}
          getEditingProps={getEditingProps}
          getActions={nodeActions}
          getDecorations={getDecorations ?? rendererProps.getDecorations}
        />
      )}
    />
  );
}
