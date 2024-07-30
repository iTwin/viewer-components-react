/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { VisibilityTree } from "../common/components/VisibilityTree";
import { VisibilityTreeRenderer } from "../common/components/VisibilityTreeRenderer";
import { useModelsTree } from "./UseModelsTree";

import type { InstanceKey } from "@itwin/presentation-common";
import type { ComponentPropsWithoutRef } from "react";
import type { Viewport } from "@itwin/core-frontend";
import type { ModelsTreeVisibilityHandlerOverrides } from "./internal/ModelsTreeVisibilityHandler";
import type { ElementsGroupInfo, ModelsTreeHierarchyConfiguration } from "./ModelsTreeDefinition";

/** @beta */
type VisibilityTreeProps = ComponentPropsWithoutRef<typeof VisibilityTree>;

type HierarchyFilteringPaths = Awaited<ReturnType<Required<VisibilityTreeProps>["getFilteredPaths"]>>;

/** @beta */
interface ModelsTreeOwnProps {
  activeView: Viewport;
  hierarchyLevelConfig?: {
    sizeLimit?: number;
  };
  hierarchyConfig?: Partial<ModelsTreeHierarchyConfiguration>;
  visibilityHandlerOverrides?: ModelsTreeVisibilityHandlerOverrides;
  filter?: string;
  getFilteredPaths?: (props: {
    createInstanceKeyPaths: (props: { keys: Array<InstanceKey | ElementsGroupInfo> } | { label: string }) => Promise<HierarchyFilteringPaths>;
  }) => Promise<HierarchyFilteringPaths>;
}

/** @beta */
type ModelsTreeProps = ModelsTreeOwnProps & Pick<VisibilityTreeProps, "imodel" | "getSchemaContext" | "selectionStorage" | "density" | "selectionMode">;

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
  visibilityHandlerOverrides,
  getFilteredPaths,
}: ModelsTreeProps) {
  const { modelsTreeProps, rendererProps } = useModelsTree({ activeView, filter, hierarchyConfig, visibilityHandlerOverrides, getFilteredPaths });

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
