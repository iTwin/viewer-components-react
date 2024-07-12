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
import { VisibilityTreeRenderer } from "../common/components/VisibilityTreeRenderer";
import { FilterLimitExceededError } from "../common/TreeErrors";
import { useTelemetryContext } from "../common/UseTelemetryContext";
import { CategoriesTreeComponent } from "./CategoriesTreeComponent";
import { CategoriesTreeDefinition } from "./CategoriesTreeDefinition";
import { CategoriesVisibilityHandler } from "./CategoriesVisibilityHandler";

import type { CategoryInfo } from "../common/CategoriesVisibilityUtils";
import type { ComponentPropsWithoutRef } from "react";
import type { ViewManager, Viewport } from "@itwin/core-frontend";
import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";

type CategoriesTreeFilteringError = "tooManyFilterMatches" | "unknownFilterError";

/** @beta */
interface CategoriesTreeOwnProps {
  filter: string;
  activeView: Viewport;
  categories: CategoryInfo[];
  viewManager?: ViewManager;
  allViewports?: boolean;
  hierarchyLevelConfig?: {
    sizeLimit?: number;
  };
}

/** @beta */
type VisibilityTreeProps = ComponentPropsWithoutRef<typeof VisibilityTree>;

/** @beta */
type CategoriesTreeProps = CategoriesTreeOwnProps &
  Pick<VisibilityTreeProps, "imodel" | "getSchemaContext" | "selectionStorage" | "height" | "width" | "density" | "selectionMode">;

/** @beta */
export function CategoriesTree({
  imodel,
  viewManager,
  categories,
  allViewports,
  getSchemaContext,
  selectionStorage,
  height,
  width,
  activeView,
  filter,
  density,
  hierarchyLevelConfig,
  selectionMode,
}: CategoriesTreeProps) {
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
  const { onFeatureUsed } = useTelemetryContext();

  const getDefinitionsProvider = useCallback<VisibilityTreeProps["getHierarchyDefinition"]>(
    (props) => {
      return new CategoriesTreeDefinition({ ...props, viewType: activeView.view.is2d() ? "2d" : "3d" });
    },
    [activeView],
  );

  const getSearchFilteredPaths = useMemo<VisibilityTreeProps["getFilteredPaths"] | undefined>(() => {
    setFilteringError(undefined);
    if (!filter) {
      return undefined;
    }
    return async ({ imodelAccess }) => {
      onFeatureUsed({ featureId: "filtering", reportInteraction: true });
      try {
        return await CategoriesTreeDefinition.createInstanceKeyPaths({ imodelAccess, label: filter, viewType: activeView.view.is2d() ? "2d" : "3d" });
      } catch (e) {
        const newError = FilterLimitExceededError ? "tooManyFilterMatches" : "unknownFilterError";
        if (newError !== "tooManyFilterMatches") {
          const feature = e instanceof Error && e.message.includes("query too long to execute or server is too busy") ? "error-timeout" : "error-unknown";
          onFeatureUsed({ featureId: feature, reportInteraction: false });
        }
        setFilteringError(newError);
        return [];
      }
    };
  }, [filter, activeView, onFeatureUsed]);

  return (
    <VisibilityTree
      height={height}
      width={width}
      imodel={imodel}
      treeName={CategoriesTreeComponent.id}
      selectionStorage={selectionStorage}
      getSchemaContext={getSchemaContext}
      visibilityHandlerFactory={visibilityHandlerFactory}
      getHierarchyDefinition={getDefinitionsProvider}
      getFilteredPaths={getSearchFilteredPaths}
      hierarchyLevelSizeLimit={hierarchyLevelConfig?.sizeLimit}
      density={density}
      noDataMessage={getNoDataMessage(filter, filteringError)}
      selectionMode={selectionMode ?? "none"}
      highlight={filter === undefined ? undefined : { text: filter }}
      treeRenderer={(treeProps) => <VisibilityTreeRenderer {...treeProps} getIcon={getIcon} getSublabel={getSublabel} />}
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
