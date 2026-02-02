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
import { EmptyTreeContent, NoSearchMatches, SearchUnknownError, TooManySearchMatches } from "../common/components/EmptyTree.js";
import { useGuid } from "../common/internal/useGuid.js";
import { useCachedVisibility } from "../common/internal/useTreeHooks/UseCachedVisibility.js";
import { useIdsCache } from "../common/internal/useTreeHooks/UseIdsCache.js";
import { getClassesByView } from "../common/internal/Utils.js";
import { CategoriesTreeDefinition, defaultHierarchyConfiguration } from "./CategoriesTreeDefinition.js";
import { CategoriesTreeIdsCache } from "./internal/CategoriesTreeIdsCache.js";
import { useSearchPaths } from "./internal/UseSearchPaths.js";
import { CategoriesTreeVisibilityHandler } from "./internal/visibility/CategoriesTreeVisibilityHandler.js";
import { createCategoriesSearchResultsTree } from "./internal/visibility/SearchResultsTree.js";

import type { ReactNode } from "react";
import type { GuidString, Id64Array } from "@itwin/core-bentley";
import type { TreeNode } from "@itwin/presentation-hierarchies-react";
import type { CategoryInfo } from "../common/CategoriesVisibilityUtils.js";
import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";
import type { ExtendedVisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer.js";
import type { CreateSearchResultsTreeProps, CreateTreeSpecificVisibilityHandlerProps } from "../common/internal/useTreeHooks/UseCachedVisibility.js";
import type { CreateCacheProps } from "../common/internal/useTreeHooks/UseIdsCache.js";
import type { SearchResultsTree } from "../common/internal/visibility/BaseSearchResultsTree.js";
import type { TreeWidgetViewport } from "../common/TreeWidgetViewport.js";
import type { CategoriesTreeHierarchyConfiguration } from "./CategoriesTreeDefinition.js";
import type { CategoriesTreeSearchError } from "./internal/UseSearchPaths.js";
import type { CategoriesTreeSearchTargets } from "./internal/visibility/SearchResultsTree.js";

/** @beta */
export interface UseCategoriesTreeProps {
  activeView: TreeWidgetViewport;
  onCategoriesFiltered?: (props: { categories: CategoryInfo[] | undefined; models?: Id64Array }) => void;
  searchText?: string;
  emptyTreeContent?: ReactNode;
  hierarchyConfig?: Partial<CategoriesTreeHierarchyConfiguration>;
  getTreeItemProps?: ExtendedVisibilityTreeRendererProps["getTreeItemProps"];
}

/** @beta */
interface UseCategoriesTreeResult {
  treeProps: Pick<
    VisibilityTreeProps,
    "treeName" | "getHierarchyDefinition" | "getSearchPaths" | "visibilityHandlerFactory" | "highlightText" | "emptyTreeContent"
  >;
  getTreeItemProps: Required<ExtendedVisibilityTreeRendererProps>["getTreeItemProps"];
}

/**
 * Custom hook to create and manage state for the categories tree.
 * @beta
 */
export function useCategoriesTree({
  searchText,
  activeView,
  onCategoriesFiltered,
  emptyTreeContent,
  hierarchyConfig,
  getTreeItemProps,
}: UseCategoriesTreeProps): UseCategoriesTreeResult {
  const hierarchyConfiguration = useMemo<CategoriesTreeHierarchyConfiguration>(
    () => ({
      ...defaultHierarchyConfiguration,
      ...hierarchyConfig,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    Object.values(hierarchyConfig ?? {}),
  );
  const viewType = activeView.viewType === "2d" ? "2d" : "3d";
  const componentId = useGuid();

  const { getCache: getCategoriesTreeIdsCache } = useIdsCache<CategoriesTreeIdsCache>({
    imodel: activeView.iModel,
    createCache,
    componentId,
    cacheSpecificProps: {},
    cacheType: viewType,
  });

  const { visibilityHandlerFactory, onSearchPathsChanged } = useCategoriesCachedVisibility({
    activeView,
    viewType,
    getCache: getCategoriesTreeIdsCache,
    componentId,
    hierarchyConfig: hierarchyConfiguration,
  });

  const getHierarchyDefinition = useCallback<VisibilityTreeProps["getHierarchyDefinition"]>(
    (props) => {
      return new CategoriesTreeDefinition({
        ...props,
        viewType,
        idsCache: getCategoriesTreeIdsCache(),
        hierarchyConfig: hierarchyConfiguration,
      });
    },
    [viewType, getCategoriesTreeIdsCache, hierarchyConfiguration],
  );

  const { getPaths, searchError } = useSearchPaths({
    hierarchyConfiguration,
    searchText,
    getCategoriesTreeIdsCache,
    onSearchPathsChanged,
    viewType,
    onCategoriesFiltered,
    componentId,
  });

  return {
    treeProps: {
      treeName: "categories-tree-v2",
      getHierarchyDefinition,
      getSearchPaths: getPaths,
      visibilityHandlerFactory,
      emptyTreeContent: useMemo(() => getEmptyTreeContentComponent(searchText, searchError, emptyTreeContent), [searchText, searchError, emptyTreeContent]),
      highlightText: searchText,
    },
    getTreeItemProps: (node, rendererProps) => ({
      ...rendererProps.getTreeItemProps?.(node),
      decorations: <CategoriesTreeIcon node={node} />,
      description: node.nodeData.extendedData?.description,
      ...getTreeItemProps?.(node, rendererProps),
    }),
  };
}

function getEmptyTreeContentComponent(searchText?: string, error?: CategoriesTreeSearchError, emptyTreeContent?: React.ReactNode) {
  if (error) {
    if (error === "tooManySearchMatches") {
      return <TooManySearchMatches base={"categoriesTree"} />;
    }
    return <SearchUnknownError base={"categoriesTree"} />;
  }
  if (searchText) {
    return <NoSearchMatches base={"categoriesTree"} />;
  }
  if (emptyTreeContent) {
    return emptyTreeContent;
  }
  return <EmptyTreeContent icon={categorySvg} />;
}

/** @beta */
export function CategoriesTreeIcon({ node }: { node: TreeNode }) {
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

function useCategoriesCachedVisibility(props: {
  activeView: TreeWidgetViewport;
  getCache: () => CategoriesTreeIdsCache;
  viewType: "2d" | "3d";
  componentId: GuidString;
  hierarchyConfig: CategoriesTreeHierarchyConfiguration;
}) {
  const { activeView, getCache, viewType, componentId } = props;
  const { visibilityHandlerFactory, searchPaths, onSearchPathsChanged } = useCachedVisibility<CategoriesTreeIdsCache, CategoriesTreeSearchTargets>({
    activeView,
    getCache,
    createSearchResultsTree: useCallback(
      async (filteredTreeProps: CreateSearchResultsTreeProps<CategoriesTreeIdsCache>) =>
        createSearchResultsTree({ ...filteredTreeProps, viewClasses: getClassesByView(viewType) }),
      [viewType],
    ),
    createTreeSpecificVisibilityHandler: useCallback(
      (specificProps) => createTreeSpecificVisibilityHandler({ ...specificProps, hierarchyConfig: props.hierarchyConfig }),
      [props.hierarchyConfig],
    ),
    componentId,
  });

  useEffect(() => {
    getCache().clearFilteredElementsModels();
  }, [searchPaths, getCache]);

  return {
    visibilityHandlerFactory,
    onSearchPathsChanged,
  };
}

function createTreeSpecificVisibilityHandler(
  props: CreateTreeSpecificVisibilityHandlerProps<CategoriesTreeIdsCache> & {
    hierarchyConfig: CategoriesTreeHierarchyConfiguration;
  },
) {
  const { info, getCache, viewport, hierarchyConfig } = props;
  return new CategoriesTreeVisibilityHandler({
    alwaysAndNeverDrawnElementInfo: info,
    idsCache: getCache(),
    viewport,
    hierarchyConfig,
  });
}

async function createSearchResultsTree(
  props: CreateSearchResultsTreeProps<CategoriesTreeIdsCache> & { viewClasses: ReturnType<typeof getClassesByView> },
): Promise<SearchResultsTree<CategoriesTreeSearchTargets>> {
  const { searchPaths, imodelAccess, getCache, viewClasses } = props;
  return createCategoriesSearchResultsTree({
    imodelAccess,
    searchPaths,
    idsCache: getCache(),
    categoryClassName: viewClasses.categoryClass,
    categoryElementClassName: viewClasses.elementClass,
    categoryModelClassName: viewClasses.modelClass,
  });
}

function createCache(props: CreateCacheProps) {
  return new CategoriesTreeIdsCache(createECSqlQueryExecutor(props.imodel), props.viewType, props.componentId);
}
