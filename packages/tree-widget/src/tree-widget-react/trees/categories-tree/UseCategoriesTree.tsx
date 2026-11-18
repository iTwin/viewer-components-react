/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useState } from "react";
import categorySvg from "@stratakit/icons/bis-category-3d.svg";
import { EmptyTreeContent, NoSearchMatches, SearchUnknownError, TooManySearchMatches } from "../../shared/components/EmptyTree.js";
import { useSharedTreeContext } from "../../shared/contexts/SharedTreeContext.js";
import { useCachedVisibility } from "../../shared/internal/hooks/UseCachedVisibility.js";
import { useGuid } from "../../shared/internal/hooks/UseGuid.js";
import { createIModelAccess } from "../../shared/internal/hooks/UseIModelAccess.js";
import { getClassesByPerspective, mergeWithDefaults, stableStringify } from "../../shared/internal/Utils.js";
import { CategoriesTreeDefinition, defaultHierarchyConfiguration } from "./CategoriesTreeDefinition.js";
import { CategoriesTreeIcon } from "./CategoriesTreeIcon.js";
import { createCategoriesTreeIdsProvider } from "./internal/CategoriesTreeIdsProvider.js";
import { useSearchPaths } from "./internal/UseSearchPaths.js";
import { CategoriesTreeVisibilityHandler } from "./internal/visibility/CategoriesTreeVisibilityHandler.js";
import { createCategoriesSearchResultsTree } from "./internal/visibility/SearchResultsTree.js";

import type { ReactNode } from "react";
import type { GuidString, Id64Array } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { EC } from "@itwin/presentation-shared";
import type { VisibilityTreeProps } from "../../shared/components/VisibilityTree.js";
import type { ExtendedVisibilityTreeRendererProps } from "../../shared/components/VisibilityTreeRenderer.js";
import type { CreateSearchResultsTreeProps, CreateTreeSpecificVisibilityHandlerProps } from "../../shared/internal/hooks/UseCachedVisibility.js";
import type { SharedIdsProvider } from "../../shared/internal/idsProviders/SharedIdsProvider.js";
import type { SearchResultsTree } from "../../shared/internal/visibility/BaseSearchResultsTree.js";
import type { TreeWidgetViewport } from "../../shared/TreeWidgetViewport.js";
import type { CategoryInfo } from "./CategoriesTreeButtons.js";
import type { CategoriesTreeHierarchyConfiguration, RequiredCategoriesTreeHierarchyConfiguration } from "./CategoriesTreeDefinition.js";
import type { CategoriesTreeIdsProvider } from "./internal/CategoriesTreeIdsProvider.js";
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
    "treeName" | "getHierarchyDefinition" | "getSearchPaths" | "visibilityHandlerFactory" | "highlightText" | "emptyTreeContent" | "onNodeExpanded"
  >;
  getTreeItemProps: Required<ExtendedVisibilityTreeRendererProps>["getTreeItemProps"];
}

/**
 * Custom hook to create and manage state for the categories tree.
 *
 * **Note:** Requires `TreeWidgetContextProvider` to be present in components tree above.
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
  const hierarchyConfigFingerprint = stableStringify(hierarchyConfig);
  const hierarchyConfiguration = useMemo(
    () =>
      mergeWithDefaults({
        defaults: defaultHierarchyConfiguration,
        overrides: hierarchyConfig,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hierarchyConfigFingerprint],
  );
  const [perspective, setPerspective] = useState<"2d" | "3d">(activeView.viewType === "2d" ? "2d" : "3d");
  const componentId = useGuid();

  // Listen for view type changes
  useEffect(() => {
    return activeView.onDisplayStyleChanged.addListener(() => {
      setPerspective(activeView.viewType === "2d" ? "2d" : "3d");
    });
  }, [activeView]);

  const idsProviders = useCategoriesTreeIdsProviders({
    imodel: activeView.iModel,
    perspective,
    excludedElementClassNames: hierarchyConfiguration.elements.nodes === "include" ? hierarchyConfiguration.elements.excludedClasses : undefined,
  });
  const { idsProvider, sharedIdsProvider } = idsProviders;

  const { visibilityHandlerFactory, onSearchPathsChanged } = useCategoriesCachedVisibility({
    activeView,
    perspective,
    idsProviders,
    componentId,
    hierarchyConfig: hierarchyConfiguration,
  });

  const onNodeExpanded = useCallback(() => {
    void idsProvider.preloadDefinitionContainers();
    if (hierarchyConfiguration.elements.nodes === "include") {
      void sharedIdsProvider.models.preloadData();
    }
  }, [idsProvider, sharedIdsProvider, hierarchyConfiguration]);

  const getHierarchyDefinition = useCallback<VisibilityTreeProps["getHierarchyDefinition"]>(
    (props) => {
      return new CategoriesTreeDefinition({
        ...props,
        perspective,
        idsProvider,
        hierarchyConfig: hierarchyConfiguration,
      });
    },
    [perspective, idsProvider, hierarchyConfiguration],
  );

  const { getPaths, searchError } = useSearchPaths({
    hierarchyConfig: hierarchyConfiguration,
    searchText,
    searchLimit,
    idsProvider,
    onSearchPathsChanged,
    perspective,
    onCategoriesFiltered,
    componentId,
  });

  return {
    treeProps: {
      treeName: "categories-tree-v2",
      getHierarchyDefinition,
      getSearchPaths: getPaths,
      visibilityHandlerFactory,
      emptyTreeContent: useMemo(
        (): ReactNode => getEmptyTreeContentComponent(searchText, searchError, emptyTreeContent),
        [searchText, searchError, emptyTreeContent],
      ),
      highlightText: searchText,
      onNodeExpanded,
    },
    getTreeItemProps: (node, rendererProps) => ({
      ...rendererProps.getTreeItemProps?.(node),
      decorations: <CategoriesTreeIcon node={node} />,
      description: node.nodeData.extendedData?.description,
      ...getTreeItemProps?.(node, rendererProps),
    }),
  };
}

function getEmptyTreeContentComponent(searchText?: string, error?: CategoriesTreeSearchError, emptyTreeContent?: React.ReactNode): ReactNode {
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

interface CategoriesTreeIdsProviders {
  idsProvider: CategoriesTreeIdsProvider;
  sharedIdsProvider: SharedIdsProvider;
}

function useCategoriesCachedVisibility(props: {
  activeView: TreeWidgetViewport;
  idsProviders: CategoriesTreeIdsProviders;
  perspective: "2d" | "3d";
  componentId: GuidString;
  hierarchyConfig: RequiredCategoriesTreeHierarchyConfiguration;
}) {
  const { activeView, idsProviders, perspective, componentId, hierarchyConfig } = props;
  const { visibilityHandlerFactory, searchPaths, onSearchPathsChanged } = useCachedVisibility<CategoriesTreeIdsProviders, CategoriesTreeSearchTargets>({
    activeView,
    idsProvider: idsProviders,
    createSearchResultsTree: useCallback(
      async (filteredTreeProps: CreateSearchResultsTreeProps<CategoriesTreeIdsProviders>) =>
        createSearchResultsTree({ ...filteredTreeProps, viewClasses: getClassesByPerspective(perspective) }),
      [perspective],
    ),
    createTreeSpecificVisibilityHandler: useCallback(
      (specificProps) => createTreeSpecificVisibilityHandler({ ...specificProps, hierarchyConfig }),
      [hierarchyConfig],
    ),
    componentId,
  });

  useEffect(() => {
    idsProviders.idsProvider.clearFilteredElementsModels();
  }, [searchPaths, idsProviders]);

  return {
    visibilityHandlerFactory,
    onSearchPathsChanged,
  };
}

function createTreeSpecificVisibilityHandler(
  props: CreateTreeSpecificVisibilityHandlerProps<CategoriesTreeIdsProviders> & {
    hierarchyConfig: RequiredCategoriesTreeHierarchyConfiguration;
  },
) {
  const { info, idsProvider, viewport, hierarchyConfig } = props;
  return new CategoriesTreeVisibilityHandler({
    alwaysAndNeverDrawnElementInfo: info,
    idsProvider: idsProvider.idsProvider,
    sharedIdsProvider: idsProvider.sharedIdsProvider,
    viewport,
    hierarchyConfig,
  });
}

async function createSearchResultsTree(
  props: CreateSearchResultsTreeProps<CategoriesTreeIdsProviders> & { viewClasses: ReturnType<typeof getClassesByPerspective> },
): Promise<SearchResultsTree<CategoriesTreeSearchTargets>> {
  const { searchPaths, imodelAccess, idsProvider, viewClasses } = props;
  return createCategoriesSearchResultsTree({
    imodelAccess,
    searchPaths,
    idsProvider: idsProvider.idsProvider,
    categoryClassName: viewClasses.categoryClass,
    categoryElementClassName: viewClasses.elementClass,
    categoryModelClassName: viewClasses.modelClass,
  });
}

function useCategoriesTreeIdsProviders({
  imodel,
  perspective,
  excludedElementClassNames,
}: {
  imodel: IModelConnection;
  perspective: "2d" | "3d";
  excludedElementClassNames?: Array<EC.FullClassNameDotNotation>;
}): CategoriesTreeIdsProviders {
  const { getSharedIdsProvider, getIdsProvider } = useSharedTreeContext();

  const sharedIdsProvider = getSharedIdsProvider({
    elementClassName: getClassesByPerspective(perspective).elementClass,
    excludedElementClassNames,
    imodel,
  });
  const categoriesTreeIdsProvider = getIdsProvider({
    imodel,
    createIdsProvider: (): CategoriesTreeIdsProviders => ({
      idsProvider: createCategoriesTreeIdsProvider({
        imodelAccess: createIModelAccess({ imodel, hierarchyLevelSizeLimit: "unbounded" }),
        perspective,
        sharedIdsProvider,
      }),
      sharedIdsProvider,
    }),
    idsProviderKey: `${perspective}-${[...(excludedElementClassNames ?? [])].sort().join(",")}-CategoriesTreeIdsProvider`,
  });
  return categoriesTreeIdsProvider;
}
