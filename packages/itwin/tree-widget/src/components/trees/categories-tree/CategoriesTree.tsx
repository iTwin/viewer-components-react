/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useMemo, useState } from "react";
import { IModelApp } from "@itwin/core-frontend";
import { SvgLayers } from "@itwin/itwinui-icons-react";
import { Text } from "@itwin/itwinui-react";
import { TreeWidget } from "../../../TreeWidget";
import { VisibilityTree } from "../common/components/VisibilityTree";
import { useFeatureReporting } from "../common/UseFeatureReporting";
import { CategoriesTreeComponent } from "./CategoriesTreeComponent";
import { CategoriesTreeDefinition } from "./CategoriesTreeDefinition";
import { CategoriesVisibilityHandler } from "./CategoriesVisibilityHandler";

import type { CategoryInfo } from "../common/CategoriesVisibilityUtils";
import type { ComponentPropsWithoutRef } from "react";
import type { ViewManager, Viewport } from "@itwin/core-frontend";
import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";

type CategoriesTreeFilteringError = "tooManyFilterMatches" | "unknownFilterError";

interface CategoriesTreeOwnProps {
  filter: string;
  activeView: Viewport;
  categories: CategoryInfo[];
  viewManager?: ViewManager;
  allViewports?: boolean;
  hierarchyLevelConfig?: {
    sizeLimit?: number;
  };
  onPerformanceMeasured?: (featureId: string, duration: number) => void;
  onFeatureUsed?: (feature: string) => void;
}

type VisibilityTreeProps = ComponentPropsWithoutRef<typeof VisibilityTree>;
type GetFilteredPathsCallback = VisibilityTreeProps["getFilteredPaths"];
type GetHierarchyDefinitionCallback = VisibilityTreeProps["getHierarchyDefinition"];

type ModelsTreeProps = CategoriesTreeOwnProps & Pick<VisibilityTreeProps, "imodel" | "getSchemaContext" | "height" | "width" | "density" | "selectionMode">;

/** @internal */
export function CategoriesTree({
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
}: ModelsTreeProps) {
  const [filteringError, setFilteringError] = useState<CategoriesTreeFilteringError | undefined>();
  const visibilityHandlerFactory = useCallback(() => {
    const visibilityHandler = new CategoriesVisibilityHandler({
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

  const { reportUsage } = useFeatureReporting({ onFeatureUsed, treeIdentifier: CategoriesTreeComponent.id });

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
      treeName={CategoriesTreeComponent.id}
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
        onPerformanceMeasured?.(`${CategoriesTreeComponent.id}-${action}`, duration);
      }}
      reportUsage={reportUsage}
      searchText={filter}
    />
  );
}

function getNoDataMessage(filter: string, error?: CategoriesTreeFilteringError) {
  if (error) {
    return <Text>{TreeWidget.translate(`categoriesTree.filtering.${error}`)}</Text>;
  }
  if (filter) {
    return <Text>{TreeWidget.translate("categoriesTree.filtering.noMatches", { filter })}</Text>;
  }
  return undefined;
}

function getIcon() {
  return <SvgLayers />;
}

function getSublabel(node: PresentationHierarchyNode) {
  return node.extendedData?.description;
}
