/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { VisibilityTree } from "../common/components/VisibilityTree";
import { VisibilityTreeRenderer } from "../common/components/VisibilityTreeRenderer";
import { useModelsTree } from "./UseModelsTree";

import type { ComponentPropsWithoutRef } from "react";
import type { Viewport } from "@itwin/core-frontend";
import { useFocusedInstancesContext } from "../common/FocusedInstancesContext";
import { FilterLimitExceededError } from "../common/TreeErrors";
import { useIModelChangeListener } from "../common/UseIModelChangeListener";
import { useTelemetryContext } from "../common/UseTelemetryContext";
import { ModelsTreeIdsCache } from "./internal/ModelsTreeIdsCache";
import { createModelsTreeVisibilityHandler } from "./internal/ModelsTreeVisibilityHandler";
import { ModelsTreeComponent } from "./ModelsTreeComponent";
import { defaultHierarchyConfiguration, ModelsTreeDefinition } from "./ModelsTreeDefinition";

import type { ModelsTreeVisibilityHandlerOverrides } from "./internal/ModelsTreeVisibilityHandler";
import type { Id64String } from "@itwin/core-bentley";
import type { GroupingHierarchyNode, InstancesNodeKey } from "@itwin/presentation-hierarchies";
import type { ElementsGroupInfo, ModelsTreeHierarchyConfiguration } from "./ModelsTreeDefinition";
import type { InstanceKey } from "@itwin/presentation-shared";
import type { ComponentPropsWithoutRef, ReactElement } from "react";
import type { Viewport } from "@itwin/core-frontend";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";

type ModelsTreeFilteringError = "tooManyFilterMatches" | "tooManyInstancesFocused" | "unknownFilterError" | "unknownInstanceFocusError";
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
type VisibilityTreeProps = ComponentPropsWithoutRef<typeof VisibilityTree>;

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
  const { modelsTreeProps, rendererProps } = useModelsTree({ activeView, filter, hierarchyConfig, visibilityHandlerOverrides });

  return (
    <VisibilityTree
      {...modelsTreeProps}
      imodel={imodel}
      selectionStorage={selectionStorage}
      getSchemaContext={getSchemaContext}
      visibilityHandlerFactory={visibilityHandlerFactory}
      getHierarchyDefinition={getHierarchyDefinition}
      getFilteredPaths={getFilteredPaths}
      hierarchyLevelSizeLimit={hierarchyLevelConfig?.sizeLimit}
      density={density}
      selectionMode={selectionMode}
      treeRenderer={(treeProps) => <VisibilityTreeRenderer {...treeProps} {...rendererProps} />}
    />
  );
}
