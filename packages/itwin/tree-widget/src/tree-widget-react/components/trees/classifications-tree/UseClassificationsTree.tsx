/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo } from "react";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import iconBisCategory3d from "@stratakit/icons/bis-category-3d.svg";
import { EmptyTreeContent, FilterUnknownError, NoFilterMatches, TooManyFilterMatches } from "../common/components/EmptyTree.js";
import { useCachedVisibility } from "../common/internal/useTreeHooks/UseCachedVisibility.js";
import { useIdsCache } from "../common/internal/useTreeHooks/UseIdsCache.js";
import { ClassificationsTreeComponent } from "./ClassificationsTreeComponent.js";
import { ClassificationsTreeDefinition } from "./ClassificationsTreeDefinition.js";
import { ClassificationsTreeIcon } from "./ClassificationsTreeIcon.js";
import { ClassificationsTreeIdsCache } from "./internal/ClassificationsTreeIdsCache.js";
import { useFilteredPaths } from "./internal/UseFilteredPaths.js";
import { ClassificationsTreeVisibilityHandler } from "./internal/visibility/ClassificationsTreeVisibilityHandler.js";
import { createFilteredClassificationsTree } from "./internal/visibility/FilteredTree.js";

import type { ReactNode } from "react";
import type { Viewport } from "@itwin/core-frontend";
import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";
import type { VisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer.js";
import type { FilteredTree } from "../common/internal/visibility/BaseFilteredTree.js";
import type { CreateFilteredTreeProps, CreateTreeSpecificVisibilityHandlerProps } from "../common/internal/useTreeHooks/UseCachedVisibility.js";
import type { CreateCacheProps } from "../common/internal/useTreeHooks/UseIdsCache.js";
import type { ClassificationsTreeHierarchyConfiguration } from "./ClassificationsTreeDefinition.js";
import type { ClassificationsTreeFilteringError } from "./internal/UseFilteredPaths.js";
import type { ClassificationsTreeFilterTargets } from "./internal/visibility/FilteredTree.js";

/** @alpha */
export interface UseClassificationsTreeProps {
  activeView: Viewport;
  hierarchyConfig: ClassificationsTreeHierarchyConfiguration;
  emptyTreeContent?: ReactNode;
  filter?: string;
}

/** @alpha */
interface UseClassificationsTreeResult {
  classificationsTreeProps: Pick<
    VisibilityTreeProps,
    "treeName" | "getHierarchyDefinition" | "visibilityHandlerFactory" | "getFilteredPaths" | "emptyTreeContent" | "highlightText"
  >;
  rendererProps: Required<Pick<VisibilityTreeRendererProps, "getDecorations">>;
}

/**
 * Custom hook to create and manage state for the categories tree.
 * @alpha
 */
export function useClassificationsTree({ activeView, emptyTreeContent, filter, ...rest }: UseClassificationsTreeProps): UseClassificationsTreeResult {
  const hierarchyConfig = useMemo(
    () => ({ ...rest.hierarchyConfig }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...Object.values(rest.hierarchyConfig)],
  );
  const { getCache: getClassificationsTreeIdsCache } = useIdsCache<ClassificationsTreeIdsCache, { hierarchyConfig: ClassificationsTreeHierarchyConfiguration }>(
    {
      imodel: activeView.iModel,
      createCache,
      cacheSpecificProps: useMemo(() => ({ hierarchyConfig }), [hierarchyConfig]),
    },
  );

  const { visibilityHandlerFactory, onFilteredPathsChanged } = useClassificationsCachedVisibility({
    activeView,
    getCache: getClassificationsTreeIdsCache,
  });

  const getHierarchyDefinition = useCallback<VisibilityTreeProps["getHierarchyDefinition"]>(
    (props) => {
      return new ClassificationsTreeDefinition({ ...props, idsCache: getClassificationsTreeIdsCache(), hierarchyConfig });
    },
    [getClassificationsTreeIdsCache, hierarchyConfig],
  );

  const { getPaths, filteringError } = useFilteredPaths({
    hierarchyConfiguration: hierarchyConfig,
    filter,
    getClassificationsTreeIdsCache,
    onFilteredPathsChanged,
  });

  return {
    classificationsTreeProps: {
      treeName: ClassificationsTreeComponent.id,
      getHierarchyDefinition,
      visibilityHandlerFactory,
      getFilteredPaths: getPaths,
      emptyTreeContent: useMemo(() => getEmptyTreeContentComponent(filter, filteringError, emptyTreeContent), [filter, filteringError, emptyTreeContent]),
      highlightText: filter,
    },
    rendererProps: {
      getDecorations: useCallback((node) => <ClassificationsTreeIcon node={node} />, []),
    },
  };
}

function createCache(props: CreateCacheProps<{ hierarchyConfig: ClassificationsTreeHierarchyConfiguration }>) {
  return new ClassificationsTreeIdsCache(createECSqlQueryExecutor(props.imodel), props.specificProps.hierarchyConfig);
}

function getEmptyTreeContentComponent(filter?: string, error?: ClassificationsTreeFilteringError, emptyTreeContent?: React.ReactNode) {
  if (error) {
    if (error === "tooManyFilterMatches") {
      return <TooManyFilterMatches base={"classificationsTree"} />;
    }
    return <FilterUnknownError base={"classificationsTree"} />;
  }
  if (filter) {
    return <NoFilterMatches base={"classificationsTree"} />;
  }
  if (emptyTreeContent) {
    return emptyTreeContent;
  }
  return <EmptyTreeContent icon={iconBisCategory3d} />;
}

function useClassificationsCachedVisibility(props: { activeView: Viewport; getCache: () => ClassificationsTreeIdsCache }) {
  const { activeView, getCache } = props;
  const { visibilityHandlerFactory, filteredPaths, onFilteredPathsChanged } = useCachedVisibility<
    ClassificationsTreeIdsCache,
    ClassificationsTreeFilterTargets
  >({
    activeView,
    getCache,
    createFilteredTree,
    createTreeSpecificVisibilityHandler,
  });

  useEffect(() => {
    getCache().clearFilteredElementsData();
  }, [filteredPaths, getCache]);

  return {
    visibilityHandlerFactory,
    onFilteredPathsChanged,
  };
}

async function createFilteredTree(props: CreateFilteredTreeProps<ClassificationsTreeIdsCache>): Promise<FilteredTree<ClassificationsTreeFilterTargets>> {
  const { filteringPaths, getCache, imodelAccess } = props;
  return createFilteredClassificationsTree({
    idsCache: getCache(),
    filteringPaths,
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
