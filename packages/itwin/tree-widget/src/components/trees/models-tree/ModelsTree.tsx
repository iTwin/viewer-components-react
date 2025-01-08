/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { VisibilityTree } from "../common/components/VisibilityTree";
import { VisibilityTreeRenderer } from "../common/components/VisibilityTreeRenderer";
import { useModelsTree } from "./UseModelsTree";

import type { UseModelsTreeProps } from "./UseModelsTree";
import type { VisibilityTreeProps } from "../common/components/VisibilityTree";

/** @beta */
export type ModelsTreeProps = Pick<VisibilityTreeProps, "imodel" | "getSchemaContext" | "selectionStorage" | "density" | "selectionMode"> &
  UseModelsTreeProps & {
    hierarchyLevelConfig?: {
      sizeLimit?: number;
    };
  };

/** @beta */
export function ModelsTree({
  imodel,
  getSchemaContext,
  selectionStorage,
  activeView,
  filter,
  density,
  hierarchyLevelConfig,
  hierarchyConfig,
  selectionMode,
  selectionPredicate,
  visibilityHandlerOverrides,
  getFilteredPaths,
  onModelsFiltered,
}: ModelsTreeProps) {
  const { modelsTreeProps, rendererProps } = useModelsTree({
    activeView,
    filter,
    hierarchyConfig,
    visibilityHandlerOverrides,
    getFilteredPaths,
    onModelsFiltered,
    selectionPredicate,
  });

  return (
    <VisibilityTree
      {...modelsTreeProps}
      imodel={imodel}
      selectionStorage={selectionStorage}
      getSchemaContext={getSchemaContext}
      hierarchyLevelSizeLimit={hierarchyLevelConfig?.sizeLimit}
      density={density}
      selectionMode={selectionMode}
      treeRenderer={(treeProps) => <VisibilityTreeRenderer {...treeProps} {...rendererProps} />}
    />
  );
}
