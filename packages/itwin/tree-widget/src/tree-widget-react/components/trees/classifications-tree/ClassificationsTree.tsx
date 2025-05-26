/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";
import { VisibilityTree } from "../common/components/VisibilityTree.js";
import { VisibilityTreeRenderer } from "../common/components/VisibilityTreeRenderer.js";
import { useClassificationsTree } from "./UseClassificationsTree.js";

import type { VisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer.js";
import type { UseClassificationsTreeProps } from "./UseClassificationsTree.js";

/** @alpha */
export type ClassificationsTreeProps = Pick<VisibilityTreeProps, "imodel" | "selectionStorage" | "selectionMode" | "emptyTreeContent"> &
  Pick<VisibilityTreeRendererProps, "getActions" | "getDecorations"> &
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
  rootClassificationSystemCode,
  hierarchyLevelConfig,
  selectionMode,
  emptyTreeContent,
  getDecorations,
  getActions,
}: ClassificationsTreeProps) {
  const { categoriesTreeProps, rendererProps } = useClassificationsTree({
    activeView,
    rootClassificationSystemCode,
    emptyTreeContent,
  });

  return (
    <VisibilityTree
      {...categoriesTreeProps}
      imodel={imodel}
      selectionStorage={selectionStorage}
      hierarchyLevelSizeLimit={hierarchyLevelConfig?.sizeLimit}
      selectionMode={selectionMode ?? "none"}
      treeRenderer={(treeProps) => (
        <VisibilityTreeRenderer {...treeProps} {...rendererProps} getActions={getActions} getDecorations={getDecorations ?? rendererProps.getDecorations} />
      )}
    />
  );
}
