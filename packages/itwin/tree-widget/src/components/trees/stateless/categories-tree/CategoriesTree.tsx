/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useMemo } from "react";
import { IModelApp } from "@itwin/core-frontend";
import { Text } from "@itwin/itwinui-react";
import { VisibilityTree } from "../common/components/VisibilityTree";
import { CategoriesTreeDefinition } from "./CategoriesTreeDefinition";
import { StatelessCategoriesVisibilityHandler } from "./CategoriesVisibilityHandler";

import type { ComponentPropsWithoutRef, ReactElement } from "react";
import type { CategoryInfo } from "../../category-tree/CategoriesTreeButtons";
import type { ViewManager, Viewport } from "@itwin/core-frontend";
import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { HierarchyLevelConfig } from "../../common/Types";

interface StatelessCategoriesTreeOwnProps {
  filter: string;
  activeView: Viewport;
  categories: CategoryInfo[];
  viewManager?: ViewManager;
  allViewports?: boolean;
  hierarchyLevelConfig?: Omit<HierarchyLevelConfig, "isFilteringEnabled">;
}

type VisibilityTreeProps = ComponentPropsWithoutRef<typeof VisibilityTree>;
type GetFilteredPathsCallback = VisibilityTreeProps["getFilteredPaths"];
type GetHierarchyDefinitionCallback = VisibilityTreeProps["getHierarchyDefinition"];

type StatelessModelsTreeProps = StatelessCategoriesTreeOwnProps &
  Pick<VisibilityTreeProps, "imodel" | "getSchemaContext" | "height" | "width" | "density" | "selectionMode">;

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
}: StatelessModelsTreeProps) {
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

  const getDefinitionsProvider = useCallback(
    (props: Parameters<GetHierarchyDefinitionCallback>[0]) => {
      return new CategoriesTreeDefinition({ ...props, viewType: activeView.view.is2d() ? "2d" : "3d" });
    },
    [activeView],
  );

  const getSearchFilteredPaths = useMemo<GetFilteredPathsCallback | undefined>(() => {
    if (!filter) {
      return undefined;
    }
    return async ({ imodelAccess }) =>
      CategoriesTreeDefinition.createInstanceKeyPaths({ imodelAccess, label: filter, viewType: activeView.view.is2d() ? "2d" : "3d" });
  }, [filter, activeView]);

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
      getIcon={getIcon}
      getSublabel={getSublabel}
      density={density}
      noDataMessage={getNoDataMessage(filter)}
      selectionMode={selectionMode ?? "none"}
    />
  );
}

function getNoDataMessage(filter: string) {
  if (filter) {
    return <Text>{`There are no nodes matching filter - "${filter}"`}</Text>;
  }
  return undefined;
}

function getSublabel(node: PresentationHierarchyNode): ReactElement | undefined {
  return <div style={{ marginBottom: "10px" }}>{node.extendedData?.description}</div>;
}

function getIcon(): ReactElement | undefined {
  // empty icon aligns nodes with and without an expander
  return <></>;
}
