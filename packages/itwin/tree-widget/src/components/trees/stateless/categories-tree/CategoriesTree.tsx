/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useMemo, useState } from "react";
import { IModelApp } from "@itwin/core-frontend";
import { SvgLayers } from "@itwin/itwinui-icons-react";
import { Text } from "@itwin/itwinui-react";
import { TreeWidget } from "../../../../TreeWidget";
import { useFeatureReporting } from "../../common/UseFeatureReporting";
import { VisibilityTree } from "../common/components/VisibilityTree";
import { CategoriesTreeDefinition } from "./CategoriesTreeDefinition";
import { StatelessCategoriesVisibilityHandler } from "./CategoriesVisibilityHandler";

import type { ComponentPropsWithoutRef } from "react";
import type { CategoryInfo } from "../../category-tree/CategoriesTreeButtons";
import type { ViewManager, Viewport } from "@itwin/core-frontend";
import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { HierarchyLevelConfig } from "../../common/Types";

type StatelessCategoriesTreeFilteringError = "tooManyFilterMatches" | "unknownFilterError";

interface StatelessCategoriesTreeOwnProps {
  filter: string;
  activeView: Viewport;
  categories: CategoryInfo[];
  viewManager?: ViewManager;
  allViewports?: boolean;
  hierarchyLevelConfig?: Omit<HierarchyLevelConfig, "isFilteringEnabled">;
  onPerformanceMeasured?: (featureId: string, duration: number) => void;
  onFeatureUsed?: (feature: string) => void;
}

type VisibilityTreeProps = ComponentPropsWithoutRef<typeof VisibilityTree>;
type GetFilteredPathsCallback = VisibilityTreeProps["getFilteredPaths"];
type GetHierarchyDefinitionCallback = VisibilityTreeProps["getHierarchyDefinition"];

type StatelessModelsTreeProps = StatelessCategoriesTreeOwnProps &
  Pick<VisibilityTreeProps, "imodel" | "getSchemaContext" | "height" | "width" | "density" | "selectionMode">;

/** @internal */
export const StatelessCategoriesTreeId = "categories-tree-v2";

/** @internal */
export function StatelessCategoriesTree({
  imodel,
  viewManager,
  categories,
  allViewports,
  getSchemaContext,
  height,
  width,
  activeView,
  filter,
  density,
  hierarchyLevelConfig,
  selectionMode,
  onPerformanceMeasured,
  onFeatureUsed,
}: StatelessModelsTreeProps) {
  const [filteringError, setFilteringError] = useState<StatelessCategoriesTreeFilteringError | undefined>();
  const visibilityHandlerFactory = useCallback(() => {
    const visibilityHandler = new StatelessCategoriesVisibilityHandler({
      imodel,
      viewport: activeView,
      viewManager: viewManager ?? IModelApp.viewManager,
      categories,
      allViewports,
    });
    return {
      getVisibilityStatus: async (node: HierarchyNode) => visibilityHandler.getVisibilityStatus(node),
      changeVisibility: async (node: HierarchyNode, on: boolean) => visibilityHandler.changeVisibility(node, on),
      onVisibilityChange: visibilityHandler.onVisibilityChange,
      dispose: () => visibilityHandler.dispose(),
    };
  }, [activeView, allViewports, categories, imodel, viewManager]);

  const { reportUsage } = useFeatureReporting({ onFeatureUsed, treeIdentifier: StatelessCategoriesTreeId });

  const getDefinitionsProvider = useCallback(
    (props: Parameters<GetHierarchyDefinitionCallback>[0]) => {
      return new CategoriesTreeDefinition({ ...props, viewType: activeView.view.is2d() ? "2d" : "3d" });
    },
    [activeView],
  );

  const getSearchFilteredPaths = useMemo<GetFilteredPathsCallback | undefined>(() => {
    setFilteringError(undefined);
    if (!filter) {
      return undefined;
    }
    return async ({ imodelAccess }) => {
      reportUsage?.({ featureId: "filtering", reportInteraction: true });
      try {
        return await CategoriesTreeDefinition.createInstanceKeyPaths({ imodelAccess, label: filter, viewType: activeView.view.is2d() ? "2d" : "3d" });
      } catch (e) {
        const newError = e instanceof Error && e.message.match(/Filter matches more than \d+ items/) ? "tooManyFilterMatches" : "unknownFilterError";
        setFilteringError(newError);
        return [];
      }
    };
  }, [filter, activeView, reportUsage]);

  return (
    <VisibilityTree
      height={height}
      width={width}
      imodel={imodel}
      treeName="StatelessCategoriesTree"
      getSchemaContext={getSchemaContext}
      visibilityHandlerFactory={visibilityHandlerFactory}
      getHierarchyDefinition={getDefinitionsProvider}
      getFilteredPaths={getSearchFilteredPaths}
      hierarchyLevelSizeLimit={hierarchyLevelConfig?.sizeLimit}
      getSublabel={getSublabel}
      getIcon={getIcon}
      density={density}
      noDataMessage={getNoDataMessage(filter, filteringError)}
      selectionMode={selectionMode ?? "none"}
      onPerformanceMeasured={(action, duration) => {
        onPerformanceMeasured?.(`${StatelessCategoriesTreeId}-${action}`, duration);
      }}
      reportUsage={reportUsage}
      searchText={filter}
      nodeHeight={42}
    />
  );
}

function getNoDataMessage(filter: string, error?: StatelessCategoriesTreeFilteringError) {
  if (error) {
    return <Text>{TreeWidget.translate(`stateless.${error}`)}</Text>;
  }
  if (filter) {
    return <Text>{TreeWidget.translate("stateless.noNodesMatchFilter", { filter })}</Text>;
  }
  return undefined;
}

function getIcon() {
  return <SvgLayers />;
}

function getSublabel(node: PresentationHierarchyNode) {
  return node.extendedData?.description;
}
