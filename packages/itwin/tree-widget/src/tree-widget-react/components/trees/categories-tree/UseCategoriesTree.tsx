/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useState } from "react";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { Icon } from "@stratakit/foundations";
import categorySvg from "@stratakit/icons/bis-category-3d.svg";
import subcategorySvg from "@stratakit/icons/bis-category-subcategory.svg";
import classSvg from "@stratakit/icons/bis-class.svg";
import definitionContainerSvg from "@stratakit/icons/bis-definitions-container.svg";
import elementSvg from "@stratakit/icons/bis-element.svg";
import { EmptyTreeContent, NoSearchMatches, SearchUnknownError, TooManySearchMatches } from "../common/components/EmptyTree.js";
import { useSharedTreeContextInternal } from "../common/internal/SharedTreeContextProviderInternal.js";
import { useGuid } from "../common/internal/useGuid.js";
import { useCachedVisibility } from "../common/internal/useTreeHooks/UseCachedVisibility.js";
import { getClassesByView, mergeWithDefaults } from "../common/internal/Utils.js";
import { CategoriesTreeDefinition, defaultHierarchyConfiguration } from "./CategoriesTreeDefinition.js";
import { CategoriesTreeIdsCache } from "./internal/CategoriesTreeIdsCache.js";
import { useSearchPaths } from "./internal/UseSearchPaths.js";
import { CategoriesTreeVisibilityHandler } from "./internal/visibility/CategoriesTreeVisibilityHandler.js";
import { createCategoriesSearchResultsTree } from "./internal/visibility/SearchResultsTree.js";

import type { ReactNode } from "react";
import type { GuidString, Id64Array } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { TreeNode } from "@itwin/presentation-hierarchies-react";
import type { EC } from "@itwin/presentation-shared";
import type { CategoryInfo } from "../common/CategoriesVisibilityUtils.js";
import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";
import type { ExtendedVisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer.js";
import type { CreateSearchResultsTreeProps, CreateTreeSpecificVisibilityHandlerProps } from "../common/internal/useTreeHooks/UseCachedVisibility.js";
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
  /**
   * Limit of how many search results are allowed. Applies to label search by `searchText`.
   *
   * Can be a number or "unbounded" for no limit.
   *
   * Defaults to `100`.
   */
  searchLimit?: number | "unbounded";
  emptyTreeContent?: ReactNode;
  hierarchyConfig?: CategoriesTreeHierarchyConfiguration;
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
 *
 * **Note:** Requires `SharedTreeContextProvider` to be present in components tree above.
 * @beta
 */
export function useCategoriesTree({
  searchText,
  searchLimit,
  activeView,
  onCategoriesFiltered,
  emptyTreeContent,
  hierarchyConfig,
  getTreeItemProps,
}: UseCategoriesTreeProps): UseCategoriesTreeResult {
  const excludedClassesConfig = hierarchyConfig?.elements?.nodes === "include" ? hierarchyConfig?.elements?.excludedClasses : undefined;
  const hierarchyConfiguration = useMemo(
    () =>
      mergeWithDefaults({
        defaults: defaultHierarchyConfiguration,
        overrides: hierarchyConfig,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hierarchyConfig?.elements?.nodes, excludedClassesConfig, hierarchyConfig?.subCategories?.nodes, hierarchyConfig?.categories?.withoutElements],
  );
  const [viewType, setViewType] = useState<"2d" | "3d">(activeView.viewType === "2d" ? "2d" : "3d");
  const componentId = useGuid();

  // Listen for view type changes
  useEffect(() => {
    return activeView.onDisplayStyleChanged.addListener(() => {
      setViewType(activeView.viewType === "2d" ? "2d" : "3d");
    });
  }, [activeView]);

  const idsCache = useCategoriesTreeIdsCache({
    imodel: activeView.iModel,
    activeViewType: viewType,
    excludedElementClassNames: hierarchyConfiguration.elements.nodes === "include" ? hierarchyConfiguration.elements.excludedClasses : undefined,
  });

  const { visibilityHandlerFactory, onSearchPathsChanged } = useCategoriesCachedVisibility({
    activeView,
    viewType,
    idsCache,
    componentId,
    hierarchyConfig: hierarchyConfiguration,
  });

  const getHierarchyDefinition = useCallback<VisibilityTreeProps["getHierarchyDefinition"]>(
    (props) => {
      return new CategoriesTreeDefinition({
        ...props,
        viewType,
        idsCache,
        hierarchyConfig: hierarchyConfiguration,
      });
    },
    [viewType, idsCache, hierarchyConfiguration],
  );

  const { getPaths, searchError } = useSearchPaths({
    hierarchyConfig: hierarchyConfiguration,
    searchText,
    searchLimit,
    idsCache,
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
  idsCache: CategoriesTreeIdsCache;
  viewType: "2d" | "3d";
  componentId: GuidString;
  hierarchyConfig: CategoriesTreeHierarchyConfiguration;
}) {
  const { activeView, idsCache, viewType, componentId, hierarchyConfig } = props;
  const { visibilityHandlerFactory, searchPaths, onSearchPathsChanged } = useCachedVisibility<CategoriesTreeIdsCache, CategoriesTreeSearchTargets>({
    activeView,
    idsCache,
    createSearchResultsTree: useCallback(
      async (filteredTreeProps: CreateSearchResultsTreeProps<CategoriesTreeIdsCache>) =>
        createSearchResultsTree({ ...filteredTreeProps, viewClasses: getClassesByView(viewType) }),
      [viewType],
    ),
    createTreeSpecificVisibilityHandler: useCallback(
      (specificProps) => createTreeSpecificVisibilityHandler({ ...specificProps, hierarchyConfig }),
      [hierarchyConfig],
    ),
    componentId,
  });

  useEffect(() => {
    idsCache.clearFilteredElementsModels();
  }, [searchPaths, idsCache]);

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
  const { info, idsCache, viewport, hierarchyConfig } = props;
  return new CategoriesTreeVisibilityHandler({
    alwaysAndNeverDrawnElementInfo: info,
    idsCache,
    viewport,
    hierarchyConfig,
  });
}

async function createSearchResultsTree(
  props: CreateSearchResultsTreeProps<CategoriesTreeIdsCache> & { viewClasses: ReturnType<typeof getClassesByView> },
): Promise<SearchResultsTree<CategoriesTreeSearchTargets>> {
  const { searchPaths, imodelAccess, idsCache, viewClasses } = props;
  return createCategoriesSearchResultsTree({
    imodelAccess,
    searchPaths,
    idsCache,
    categoryClassName: viewClasses.categoryClass,
    categoryElementClassName: viewClasses.elementClass,
    categoryModelClassName: viewClasses.modelClass,
  });
}

function useCategoriesTreeIdsCache({
  imodel,
  activeViewType,
  excludedElementClassNames,
}: {
  imodel: IModelConnection;
  activeViewType: "2d" | "3d";
  excludedElementClassNames?: Array<EC.FullClassNameDotNotation>;
}): CategoriesTreeIdsCache {
  const { getBaseIdsCache, getCache } = useSharedTreeContextInternal();

  const baseIdsCache = getBaseIdsCache({
    type: activeViewType,
    elementClassName: getClassesByView(activeViewType).elementClass,
    excludedElementClassNames,
    imodel,
  });
  const categoriesTreeIdsCache = getCache({
    imodel,
    createCache: () =>
      new CategoriesTreeIdsCache({ baseIdsCache, type: activeViewType, queryExecutor: createECSqlQueryExecutor(imodel), excludedElementClassNames }),
    cacheKey: `${activeViewType}-${[...(excludedElementClassNames ?? [])].sort().join(",")}-CategoriesTreeIdsCache`,
  });
  return categoriesTreeIdsCache;
}
