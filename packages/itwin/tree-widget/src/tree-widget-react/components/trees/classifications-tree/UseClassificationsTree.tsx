/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo } from "react";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import iconBisCategory3d from "@stratakit/icons/bis-category-3d.svg";
import { EmptyTreeContent, NoSearchMatches, SearchUnknownError, TooManySearchMatches } from "../common/components/EmptyTree.js";
import { useSharedTreeContextInternal } from "../common/internal/SharedTreeWidgetContextProviderInternal.js";
import { useGuid } from "../common/internal/useGuid.js";
import { useCachedVisibility } from "../common/internal/useTreeHooks/UseCachedVisibility.js";
import { getClassesByView } from "../common/internal/Utils.js";
import { ClassificationsTreeComponent } from "./ClassificationsTreeComponent.js";
import { ClassificationsTreeDefinition } from "./ClassificationsTreeDefinition.js";
import { ClassificationsTreeIcon } from "./ClassificationsTreeIcon.js";
import { ClassificationsTreeIdsCache } from "./internal/ClassificationsTreeIdsCache.js";
import { useSearchPaths } from "./internal/UseSearchPaths.js";
import { ClassificationsTreeVisibilityHandler } from "./internal/visibility/ClassificationsTreeVisibilityHandler.js";
import { createClassificationsSearchResultsTree } from "./internal/visibility/SearchResultsTree.js";

import type { ReactNode } from "react";
import type { GuidString } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";
import type { ExtendedVisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer.js";
import type { CreateSearchResultsTreeProps, CreateTreeSpecificVisibilityHandlerProps } from "../common/internal/useTreeHooks/UseCachedVisibility.js";
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
  getTreeItemProps?: ExtendedVisibilityTreeRendererProps["getTreeItemProps"];
}

/** @alpha */
interface UseClassificationsTreeResult {
  treeProps: Pick<
    VisibilityTreeProps,
    "treeName" | "getHierarchyDefinition" | "visibilityHandlerFactory" | "getSearchPaths" | "emptyTreeContent" | "highlightText"
  >;
  getTreeItemProps: Required<ExtendedVisibilityTreeRendererProps>["getTreeItemProps"];
}

/**
 * Custom hook to create and manage state for the categories tree.
 *
 * **NOTE**: To use this hook, wrap your app component with `SharedTreeContextProvider`.
 * @alpha
 */
export function useClassificationsTree({
  activeView,
  emptyTreeContent,
  searchText,
  getTreeItemProps,
  ...rest
}: UseClassificationsTreeProps): UseClassificationsTreeResult {
  const hierarchyConfig = useMemo(
    () => ({ ...rest.hierarchyConfig }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...Object.values(rest.hierarchyConfig)],
  );
  const componentId = useGuid();

  const idsCache = useClassificationsTreeIdsCache({
    imodel: activeView.iModel,
    hierarchyConfig,
    componentId,
  });

  const { visibilityHandlerFactory, onSearchPathsChanged } = useClassificationsCachedVisibility({
    activeView,
    idsCache,
    componentId,
  });

  const getHierarchyDefinition = useCallback<VisibilityTreeProps["getHierarchyDefinition"]>(
    (props) => {
      return new ClassificationsTreeDefinition({ ...props, getIdsCache: () => idsCache, hierarchyConfig });
    },
    [idsCache, hierarchyConfig],
  );

  const { getPaths, searchError } = useSearchPaths({
    hierarchyConfiguration: hierarchyConfig,
    searchText,
    idsCache,
    onSearchPathsChanged,
    componentId,
  });

  return {
    treeProps: {
      treeName: ClassificationsTreeComponent.id,
      getHierarchyDefinition,
      visibilityHandlerFactory,
      getSearchPaths: getPaths,
      emptyTreeContent: useMemo(() => getEmptyTreeContentComponent(searchText, searchError, emptyTreeContent), [searchText, searchError, emptyTreeContent]),
      highlightText: searchText,
    },
    getTreeItemProps: (node, rendererProps) => ({
      decorations: <ClassificationsTreeIcon node={node} />,
      ...getTreeItemProps?.(node, rendererProps),
    }),
  };
}

function getEmptyTreeContentComponent(searchText?: string, error?: ClassificationsTreeSearchError, emptyTreeContent?: React.ReactNode) {
  if (error) {
    if (error === "tooManySearchMatches") {
      return <TooManySearchMatches base={"classificationsTree"} />;
    }
    return <SearchUnknownError base={"classificationsTree"} />;
  }
  if (searchText) {
    return <NoSearchMatches base={"classificationsTree"} />;
  }
  if (emptyTreeContent) {
    return emptyTreeContent;
  }
  return <EmptyTreeContent icon={iconBisCategory3d} />;
}

function useClassificationsCachedVisibility(props: { activeView: TreeWidgetViewport; idsCache: ClassificationsTreeIdsCache; componentId: GuidString }) {
  const { activeView, idsCache, componentId } = props;
  const { visibilityHandlerFactory, searchPaths, onSearchPathsChanged } = useCachedVisibility<ClassificationsTreeIdsCache, ClassificationsTreeSearchTargets>({
    activeView,
    idsCache,
    createSearchResultsTree,
    createTreeSpecificVisibilityHandler,
    componentId,
  });

  useEffect(() => {
    idsCache.clearFilteredElementsData();
  }, [searchPaths, idsCache]);

  return {
    visibilityHandlerFactory,
    onSearchPathsChanged,
  };
}

async function createSearchResultsTree(
  props: CreateSearchResultsTreeProps<ClassificationsTreeIdsCache>,
): Promise<SearchResultsTree<ClassificationsTreeSearchTargets>> {
  const { searchPaths, idsCache, imodelAccess } = props;
  return createClassificationsSearchResultsTree({
    idsCache,
    searchPaths,
    imodelAccess,
  });
}

function createTreeSpecificVisibilityHandler(props: CreateTreeSpecificVisibilityHandlerProps<ClassificationsTreeIdsCache>) {
  const { info, idsCache, viewport } = props;
  return new ClassificationsTreeVisibilityHandler({
    alwaysAndNeverDrawnElementInfo: info,
    idsCache,
    viewport,
  });
}

function useClassificationsTreeIdsCache({
  imodel,
  componentId,
  hierarchyConfig,
}: {
  imodel: IModelConnection;
  hierarchyConfig: ClassificationsTreeHierarchyConfiguration;
  componentId: GuidString;
}): ClassificationsTreeIdsCache {
  const { getBaseIdsCache, getCache } = useSharedTreeContextInternal();

  const baseIdsCache = getBaseIdsCache({ type: "3d", elementClassName: getClassesByView("3d").elementClass, imodel });
  const classificationsTreeIdsCache = getCache({
    imodel,
    createCache: () => new ClassificationsTreeIdsCache({ baseIdsCache, componentId, hierarchyConfig, queryExecutor: createECSqlQueryExecutor(imodel) }),
    cacheKey: `${hierarchyConfig.rootClassificationSystemCode}-ClassificationsTreeIdsCache`,
  });
  return classificationsTreeIdsCache;
}
