/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo } from "react";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { Icon } from "@stratakit/foundations";
import categorySvg from "@stratakit/icons/bis-category-3d.svg";
import subcategorySvg from "@stratakit/icons/bis-category-subcategory.svg";
import classSvg from "@stratakit/icons/bis-class.svg";
import definitionContainerSvg from "@stratakit/icons/bis-definitions-container.svg";
import elementSvg from "@stratakit/icons/bis-element.svg";
import { EmptyTreeContent, FilterUnknownError, NoFilterMatches, TooManyFilterMatches } from "../common/components/EmptyTree.js";
import { useCachedVisibility } from "../common/internal/useTreeHooks/UseCachedVisibility.js";
import { useIdsCache } from "../common/internal/useTreeHooks/UseIdsCache.js";
import { getClassesByView } from "../common/internal/Utils.js";
import { CategoriesTreeDefinition, defaultHierarchyConfiguration } from "./CategoriesTreeDefinition.js";
import { CategoriesTreeIdsCache } from "./internal/CategoriesTreeIdsCache.js";
import { useFilteredPaths } from "./internal/UseFilteredPaths.js";
import { CategoriesTreeVisibilityHandler } from "./internal/visibility/CategoriesTreeVisibilityHandler.js";
import { createFilteredCategoriesTree } from "./internal/visibility/FilteredTree.js";

import type { ReactNode } from "react";
import type { Id64Array } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { CreateCacheProps } from "../common/internal/useTreeHooks/UseIdsCache.js";
import type { CategoryInfo } from "../common/CategoriesVisibilityUtils.js";
import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";
import type { VisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer.js";
import type { CreateFilteredTreeProps, CreateTreeSpecificVisibilityHandlerProps } from "../common/internal/useTreeHooks/UseCachedVisibility.js";
import type { FilteredTree } from "../common/internal/visibility/BaseFilteredTree.js";
import type { CategoriesTreeHierarchyConfiguration } from "./CategoriesTreeDefinition.js";
import type { CategoriesTreeFilterTargets } from "./internal/visibility/FilteredTree.js";
import type { CategoriesTreeFilteringError } from "./internal/UseFilteredPaths.js";

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
    "treeName" | "getHierarchyDefinition" | "getFilteredPaths" | "visibilityHandlerFactory" | "highlightText" | "emptyTreeContent"
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

  const { getCache: getCategoriesTreeIdsCache } = useIdsCache<CategoriesTreeIdsCache, { viewType: "2d" | "3d" }>({
    imodel: activeView.iModel,
    createCache,
    cacheSpecificProps: useMemo(() => ({ viewType }), [viewType]),
  });

  const { visibilityHandlerFactory, onFilteredPathsChanged } = useCategoriesCachedVisibility({
    activeView,
    viewType,
    getCache: getCategoriesTreeIdsCache,
  });

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
      highlightText: filter,
    },
    rendererProps: {
      getDecorations: useCallback((node) => <CategoriesTreeIcon node={node} />, []),
      getSublabel,
    },
  };
}

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

function useCategoriesCachedVisibility(props: { activeView: Viewport; getCache: () => CategoriesTreeIdsCache; viewType: "2d" | "3d" }) {
  const { activeView, getCache, viewType } = props;
  const { visibilityHandlerFactory, filteredPaths, onFilteredPathsChanged } = useCachedVisibility<CategoriesTreeIdsCache, CategoriesTreeFilterTargets>({
    activeView,
    getCache,
    createFilteredTree: useCallback(
      async (filteredTreeProps: CreateFilteredTreeProps<CategoriesTreeIdsCache>) =>
        createFilteredTree({ ...filteredTreeProps, viewClasses: getClassesByView(viewType) }),
      [viewType],
    ),
    createTreeSpecificVisibilityHandler,
  });

  useEffect(() => {
    getCache().clearFilteredElementsModels();
  }, [filteredPaths, getCache]);

  return {
    visibilityHandlerFactory,
    onFilteredPathsChanged,
  };
}

function createTreeSpecificVisibilityHandler(props: CreateTreeSpecificVisibilityHandlerProps<CategoriesTreeIdsCache>) {
  const { info, getCache, viewport } = props;
  return new CategoriesTreeVisibilityHandler({
    alwaysAndNeverDrawnElementInfo: info,
    idsCache: getCache(),
    viewport,
  });
}

async function createFilteredTree(
  props: CreateFilteredTreeProps<CategoriesTreeIdsCache> & { viewClasses: ReturnType<typeof getClassesByView> },
): Promise<FilteredTree<CategoriesTreeFilterTargets>> {
  const { filteringPaths, imodelAccess, getCache, viewClasses } = props;
  return createFilteredCategoriesTree({
    imodelAccess,
    filteringPaths,
    idsCache: getCache(),
    categoryClassName: viewClasses.categoryClass,
    categoryElementClassName: viewClasses.elementClass,
    categoryModelClassName: viewClasses.modelClass,
  });
}

function createCache(props: CreateCacheProps<{ viewType: "2d" | "3d" }>) {
  return new CategoriesTreeIdsCache(createECSqlQueryExecutor(props.imodel), props.specificProps.viewType);
}
