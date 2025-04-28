/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@itwin/itwinui-react/bricks";
import { EmptyTreeContent, FilterUnknownError, NoFilterMatches, TooManyFilterMatches } from "../common/components/EmptyTree.js";
import { CategoriesTreeDefinition, defaultHierarchyConfiguration } from "./CategoriesTreeDefinition.js";
import { createCategoriesTreeVisibilityHandler } from "./internal/CategoriesTreeVisibilityHandler.js";
import { useFilteredPaths } from "./internal/UseFilteredPaths.js";
import { useIdsCache } from "./internal/UseIdsCache.js";

import type { CategoriesTreeFilteringError } from "./internal/UseFilteredPaths.js";
import type { HierarchyFilteringPath } from "@itwin/presentation-hierarchies";
import type { CategoriesTreeIdsCache } from "./internal/CategoriesTreeIdsCache.js";
import type { ReactNode } from "react";
import type { Id64Array } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";
import type { VisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer.js";
import type { CategoryInfo } from "../common/CategoriesVisibilityUtils.js";
import type { CategoriesTreeHierarchyConfiguration } from "./CategoriesTreeDefinition.js";
/** @beta */
export interface UseCategoriesTreeProps {
  activeView: Viewport;
  onCategoriesFiltered?: (props: { categories: CategoryInfo[] | undefined; models?: Id64Array }) => void;
  filter?: string;
  emptyTreeContent?: ReactNode;
  hierarchyConfig?: Partial<CategoriesTreeHierarchyConfiguration>;
}

/** @beta */
interface UseCategoriesTreeResult {
  categoriesTreeProps: Pick<
    VisibilityTreeProps,
    "treeName" | "getHierarchyDefinition" | "getFilteredPaths" | "visibilityHandlerFactory" | "highlight" | "emptyTreeContent"
  >;
  rendererProps: Required<Pick<VisibilityTreeRendererProps, "getDecorations" | "getSublabel">>;
}

/**
 * Custom hook to create and manage state for the categories tree.
 * @beta
 */
export function useCategoriesTree({
  filter,
  activeView,
  onCategoriesFiltered,
  emptyTreeContent,
  hierarchyConfig,
}: UseCategoriesTreeProps): UseCategoriesTreeResult {
  const hierarchyConfiguration = useMemo<CategoriesTreeHierarchyConfiguration>(
    () => ({
      ...defaultHierarchyConfiguration,
      ...hierarchyConfig,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    Object.values(hierarchyConfig ?? {}),
  );
  const viewType = activeView.view.is2d() ? "2d" : "3d";

  const { getCategoriesTreeIdsCache, visibilityHandlerFactory, onFilteredPathsChanged } = useCachedVisibility(activeView, hierarchyConfiguration, viewType);

  const getHierarchyDefinition = useCallback<VisibilityTreeProps["getHierarchyDefinition"]>(
    (props) => {
      return new CategoriesTreeDefinition({ ...props, viewType, idsCache: getCategoriesTreeIdsCache(), hierarchyConfig: hierarchyConfiguration });
    },
    [viewType, getCategoriesTreeIdsCache, hierarchyConfiguration],
  );

  const { getPaths, filteringError } = useFilteredPaths({
    hierarchyConfiguration,
    filter,
    getCategoriesTreeIdsCache,
    onFilteredPathsChanged,
    viewType,
    onCategoriesFiltered,
  });

  return {
    categoriesTreeProps: {
      treeName: "categories-tree-v2",
      getHierarchyDefinition,
      getFilteredPaths: getPaths,
      visibilityHandlerFactory,
      emptyTreeContent: useMemo(() => getEmptyTreeContentComponent(filter, filteringError, emptyTreeContent), [filter, filteringError, emptyTreeContent]),
      highlight: useMemo(() => (filter ? { text: filter } : undefined), [filter]),
    },
    rendererProps: {
      getDecorations: useCallback((node) => <CategoriesTreeIcon node={node} />, []),
      getSublabel,
    },
  };
}

function createVisibilityHandlerFactory(
  activeView: Viewport,
  idsCacheGetter: () => CategoriesTreeIdsCache,
  hierarchyConfig: CategoriesTreeHierarchyConfiguration,
  filteredPaths?: HierarchyFilteringPath[],
): VisibilityTreeProps["visibilityHandlerFactory"] {
  return ({ imodelAccess }) =>
    createCategoriesTreeVisibilityHandler({ viewport: activeView, idsCache: idsCacheGetter(), imodelAccess, filteredPaths, hierarchyConfig });
}

function useCachedVisibility(activeView: Viewport, hierarchyConfig: CategoriesTreeHierarchyConfiguration, viewType: "2d" | "3d") {
  const [filteredPaths, setFilteredPaths] = useState<HierarchyFilteringPath[]>();
  const { getCache: getCategoriesTreeIdsCache } = useIdsCache(activeView.iModel, viewType, filteredPaths);

  const [visibilityHandlerFactory, setVisibilityHandlerFactory] = useState<VisibilityTreeProps["visibilityHandlerFactory"]>(() =>
    createVisibilityHandlerFactory(activeView, getCategoriesTreeIdsCache, hierarchyConfig, filteredPaths),
  );

  useEffect(() => {
    setVisibilityHandlerFactory(() => createVisibilityHandlerFactory(activeView, getCategoriesTreeIdsCache, hierarchyConfig, filteredPaths));
  }, [activeView, getCategoriesTreeIdsCache, hierarchyConfig, filteredPaths]);

  return {
    getCategoriesTreeIdsCache,
    visibilityHandlerFactory,
    onFilteredPathsChanged: useCallback((paths: HierarchyFilteringPath[] | undefined) => setFilteredPaths(paths), []),
  };
}

const categorySvg = new URL("@itwin/itwinui-icons/bis-category-3d.svg", import.meta.url).href;

function getEmptyTreeContentComponent(filter?: string, error?: CategoriesTreeFilteringError, emptyTreeContent?: React.ReactNode) {
  if (error) {
    if (error === "tooManyFilterMatches") {
      return <TooManyFilterMatches base={"categoriesTree"} />;
    }
    return <FilterUnknownError base={"categoriesTree"} />;
  }
  if (filter) {
    return <NoFilterMatches base={"categoriesTree"} />;
  }
  if (emptyTreeContent) {
    return emptyTreeContent;
  }
  return <EmptyTreeContent icon={categorySvg} />;
}

const subcategorySvg = new URL("@itwin/itwinui-icons/bis-category-subcategory.svg", import.meta.url).href;
const definitionContainerSvg = new URL("@itwin/itwinui-icons/bis-definitions-container.svg", import.meta.url).href;
const classSvg = new URL("@itwin/itwinui-icons/bis-class.svg", import.meta.url).href;
const elementSvg = new URL("@itwin/itwinui-icons/bis-element.svg", import.meta.url).href;

/** @beta */
export function CategoriesTreeIcon({ node }: { node: PresentationHierarchyNode }) {
  if (node.nodeData.extendedData?.imageId === undefined) {
    return undefined;
  }

  const getIcon = () => {
    switch (node.nodeData.extendedData!.imageId) {
      case "icon-layers":
        return categorySvg;
      case "icon-layers-isolate":
        return subcategorySvg;
      case "icon-definition-container":
        return definitionContainerSvg;
      case "icon-item":
        return elementSvg;
      case "icon-ec-class":
        return classSvg;
      default:
        return undefined;
    }
  };

  return <Icon href={getIcon()} />;
}

function getSublabel(node: PresentationHierarchyNode) {
  return node.nodeData.extendedData?.description;
}
