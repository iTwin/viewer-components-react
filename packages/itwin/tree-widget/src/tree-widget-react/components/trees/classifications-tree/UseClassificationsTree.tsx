/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo } from "react";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import iconBisCategory3d from "@stratakit/icons/bis-category-3d.svg";
import { EmptyTreeContent, FilterUnknownError, NoFilterMatches, TooManyFilterMatches } from "../common/components/EmptyTree.js";
import { useGuid } from "../common/internal/useGuid.js";
import { useCachedVisibility } from "../common/internal/useTreeHooks/UseCachedVisibility.js";
import { useIdsCache } from "../common/internal/useTreeHooks/UseIdsCache.js";
import { ClassificationsTreeComponent } from "./ClassificationsTreeComponent.js";
import { ClassificationsTreeDefinition } from "./ClassificationsTreeDefinition.js";
import { ClassificationsTreeIcon } from "./ClassificationsTreeIcon.js";
import { ClassificationsTreeIdsCache } from "./internal/ClassificationsTreeIdsCache.js";
import { useSearchPaths } from "./internal/UseSearchPaths.js";
import { ClassificationsTreeVisibilityHandler } from "./internal/visibility/ClassificationsTreeVisibilityHandler.js";
import { createClassificationsSearchResultsTree } from "./internal/visibility/SearchResultsTree.js";

import type { ReactNode } from "react";
import type { GuidString } from "@itwin/core-bentley";
import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";
import type { VisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer.js";
import type { CreateSearchResultsTreeProps, CreateTreeSpecificVisibilityHandlerProps } from "../common/internal/useTreeHooks/UseCachedVisibility.js";
import type { CreateCacheProps } from "../common/internal/useTreeHooks/UseIdsCache.js";
import type { SearchResultsTree } from "../common/internal/visibility/BaseSearchResultsTree.js";
import type { TreeWidgetViewport } from "../common/TreeWidgetViewport.js";
import type { ClassificationsTreeHierarchyConfiguration } from "./ClassificationsTreeDefinition.js";
import type { ClassificationsTreeSearchError } from "./internal/UseSearchPaths.js";
import type { ClassificationsTreeSearchTargets } from "./internal/visibility/SearchResultsTree.js";

/** @alpha */
export interface UseClassificationsTreeProps {
  activeView: TreeWidgetViewport;
  hierarchyConfig: ClassificationsTreeHierarchyConfiguration;
  emptyTreeContent?: ReactNode;
  searchText?: string;
}

/** @alpha */
interface UseClassificationsTreeResult {
  classificationsTreeProps: Pick<
    VisibilityTreeProps,
    "treeName" | "getHierarchyDefinition" | "visibilityHandlerFactory" | "getSearchPaths" | "emptyTreeContent" | "highlightText"
  >;
  rendererProps: Required<Pick<VisibilityTreeRendererProps, "getDecorations">>;
}

/**
 * Custom hook to create and manage state for the categories tree.
 * @alpha
 */
export function useClassificationsTree({ activeView, emptyTreeContent, searchText, ...rest }: UseClassificationsTreeProps): UseClassificationsTreeResult {
  const hierarchyConfig = useMemo(
    () => ({ ...rest.hierarchyConfig }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...Object.values(rest.hierarchyConfig)],
  );
  const componentId = useGuid();

  const { getCache: getClassificationsTreeIdsCache } = useIdsCache<ClassificationsTreeIdsCache, { hierarchyConfig: ClassificationsTreeHierarchyConfiguration }>(
    {
      imodel: activeView.iModel,
      createCache,
      cacheSpecificProps: useMemo(() => ({ hierarchyConfig }), [hierarchyConfig]),
      componentId,
    },
  );

  const { visibilityHandlerFactory, onSearchPathsChanged } = useClassificationsCachedVisibility({
    activeView,
    getCache: getClassificationsTreeIdsCache,
    componentId,
  });

  const getHierarchyDefinition = useCallback<VisibilityTreeProps["getHierarchyDefinition"]>(
    (props) => {
      return new ClassificationsTreeDefinition({ ...props, getIdsCache: getClassificationsTreeIdsCache, hierarchyConfig });
    },
    [getClassificationsTreeIdsCache, hierarchyConfig],
  );

  const { getPaths, searchError } = useSearchPaths({
    hierarchyConfiguration: hierarchyConfig,
    searchText,
    getClassificationsTreeIdsCache,
    onSearchPathsChanged,
    componentId,
  });

  return {
    classificationsTreeProps: {
      treeName: ClassificationsTreeComponent.id,
      getHierarchyDefinition,
      visibilityHandlerFactory,
      getSearchPaths: getPaths,
      emptyTreeContent: useMemo(() => getEmptyTreeContentComponent(searchText, searchError, emptyTreeContent), [searchText, searchError, emptyTreeContent]),
      highlightText: searchText,
    },
    rendererProps: {
      getDecorations: useCallback((node) => <ClassificationsTreeIcon node={node} />, []),
    },
  };
}

function createCache(props: CreateCacheProps<{ hierarchyConfig: ClassificationsTreeHierarchyConfiguration }>) {
  return new ClassificationsTreeIdsCache(createECSqlQueryExecutor(props.imodel), props.specificProps.hierarchyConfig, props.componentId);
}

function getEmptyTreeContentComponent(searchText?: string, error?: ClassificationsTreeSearchError, emptyTreeContent?: React.ReactNode) {
  if (error) {
    if (error === "tooManySearchMatches") {
      return <TooManyFilterMatches base={"classificationsTree"} />;
    }
    return <FilterUnknownError base={"classificationsTree"} />;
  }
  if (searchText) {
    return <NoFilterMatches base={"classificationsTree"} />;
  }
  if (emptyTreeContent) {
    return emptyTreeContent;
  }
  return <EmptyTreeContent icon={iconBisCategory3d} />;
}

function useClassificationsCachedVisibility(props: { activeView: TreeWidgetViewport; getCache: () => ClassificationsTreeIdsCache; componentId: GuidString }) {
  const { activeView, getCache, componentId } = props;
  const { visibilityHandlerFactory, searchPaths, onSearchPathsChanged } = useCachedVisibility<ClassificationsTreeIdsCache, ClassificationsTreeSearchTargets>({
    activeView,
    getCache,
    createSearchResultsTree,
    createTreeSpecificVisibilityHandler,
    componentId,
  });

  useEffect(() => {
    getCache().clearFilteredElementsData();
  }, [searchPaths, getCache]);

  return {
    visibilityHandlerFactory,
    onSearchPathsChanged,
  };
}

async function createSearchResultsTree(
  props: CreateSearchResultsTreeProps<ClassificationsTreeIdsCache>,
): Promise<SearchResultsTree<ClassificationsTreeSearchTargets>> {
  const { searchPaths, getCache, imodelAccess } = props;
  return createClassificationsSearchResultsTree({
    idsCache: getCache(),
    searchPaths,
    imodelAccess,
  });
}

function createTreeSpecificVisibilityHandler(props: CreateTreeSpecificVisibilityHandlerProps<ClassificationsTreeIdsCache>) {
  const { info, getCache, viewport } = props;
  return new ClassificationsTreeVisibilityHandler({
    alwaysAndNeverDrawnElementInfo: info,
    idsCache: getCache(),
    viewport,
  });
}
