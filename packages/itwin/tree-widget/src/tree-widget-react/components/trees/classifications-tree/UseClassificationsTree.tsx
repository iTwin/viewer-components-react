/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useState } from "react";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import iconBisCategory3d from "@stratakit/icons/bis-category-3d.svg";
import { EmptyTreeContent, NoSearchMatches, SearchUnknownError, TooManySearchMatches } from "../common/components/EmptyTree.js";
import { useSharedTreeContextInternal } from "../common/internal/SharedTreeContextProviderInternal.js";
import { useGuid } from "../common/internal/useGuid.js";
import { useCachedVisibility } from "../common/internal/useTreeHooks/UseCachedVisibility.js";
import { getClassesByView } from "../common/internal/Utils.js";
import { SearchLimitExceededError } from "../common/TreeErrors.js";
import { useTelemetryContext } from "../common/UseTelemetryContext.js";
import { ClassificationsTreeComponent } from "./ClassificationsTreeComponent.js";
import { ClassificationsTreeIcon } from "./ClassificationsTreeIcon.js";
import { ClassificationsTreeIdsCache } from "./internal/ClassificationsTreeIdsCache.js";
import { ClassificationsTreeVisibilityHandler } from "./internal/visibility/ClassificationsTreeVisibilityHandler.js";
import { createClassificationsSearchResultsTree } from "./internal/visibility/SearchResultsTree.js";
import { useClassificationsTreeDefinitionInternal } from "./UseClassificationsTreeDefinition.js";

import type { ReactNode } from "react";
import type { GuidString } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { useTree } from "@itwin/presentation-hierarchies-react";
import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";
import type { ExtendedVisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer.js";
import type { CreateSearchResultsTreeProps, CreateTreeSpecificVisibilityHandlerProps } from "../common/internal/useTreeHooks/UseCachedVisibility.js";
import type { SearchResultsTree } from "../common/internal/visibility/BaseSearchResultsTree.js";
import type { TreeWidgetViewport } from "../common/TreeWidgetViewport.js";
import type { FunctionProps } from "../common/Utils.js";
import type { ClassificationsTreeHierarchyConfiguration } from "./ClassificationsTreeDefinition.js";
import type { HierarchyConfigForClassificationsCache, VisibilityHandlerConfigForClassificationsCache } from "./internal/ClassificationsTreeIdsCache.js";
import type { ClassificationsTreeSearchTargets } from "./internal/visibility/SearchResultsTree.js";

/**
 * Relationship used to determine related categories for classifications.
 *
 * By default, categories are determined using `ClassificationSystems.ElementHasClassifications` and `BisCore.GeometricElement3dIsInCategory` relationships.
 *
 * @alpha
 */
export interface ClassificationToCategoriesRelationshipSpecification {
  /**
   * Full class name of the relationship which links classifications to categories. Format: `{SchemaName}.{RelationshipClassName}`.
   */
  fullClassName: string;
  /**
   * Describes the relationship direction by specifying its source.
   * E.g. whether it's a `classification` -> `categories` or `category` -> `classifications` relationship.
   */
  source: "classification" | "category";
}

/**
 * Configuration for classifications tree visibility handler.
 * @alpha
 */
export interface ClassificationsTreeVisibilityHandlerConfiguration {
  /**
   * Relationship used to determine related categories for classifications.
   *
   * By default, categories are determined using `ClassificationSystems.ElementHasClassifications` and `BisCore.GeometricElement3dIsInCategory` relationships.
   */
  classificationToCategoriesRelationshipSpecification?: ClassificationToCategoriesRelationshipSpecification;
}

/** @alpha */
export interface UseClassificationsTreeProps {
  activeView: TreeWidgetViewport;
  hierarchyConfig: ClassificationsTreeHierarchyConfiguration;
  /**
   * Optional configuration for classifications tree visibility handler.
   */
  visibilityHandlerConfig?: ClassificationsTreeVisibilityHandlerConfiguration;
  emptyTreeContent?: ReactNode;
  searchText?: string;
  /**
   * Limit of how many search results are allowed. Applies to label search by `searchText`.
   *
   * Can be a number or "unbounded" for no limit.
   *
   * Defaults to `100`.
   */
  searchLimit?: number | "unbounded";
  getTreeItemProps?: ExtendedVisibilityTreeRendererProps["getTreeItemProps"];
}

type ClassificationsTreeSearchError = "tooManySearchMatches" | "unknownSearchError";

/** @alpha */
interface UseClassificationsTreeResult {
  treeProps: Pick<
    VisibilityTreeProps,
    "treeName" | "getHierarchyDefinition" | "visibilityHandlerFactory" | "getSearchPaths" | "emptyTreeContent" | "highlightText"
  >;
  getTreeItemProps: Required<ExtendedVisibilityTreeRendererProps>["getTreeItemProps"];
}

/**
 * Custom hook to create and manage state for the classifications tree.
 *
 * **Note:** Requires `SharedTreeContextProvider` to be present in components tree above.
 * @alpha
 */
export function useClassificationsTree({
  activeView,
  emptyTreeContent,
  searchText,
  searchLimit,
  getTreeItemProps,
  visibilityHandlerConfig,
  ...rest
}: UseClassificationsTreeProps): UseClassificationsTreeResult {
  const { getBaseIdsCache, getCache } = useSharedTreeContextInternal();
  const { onFeatureUsed } = useTelemetryContext();

  const [searchError, setSearchError] = useState<ClassificationsTreeSearchError | undefined>();

  const hierarchyConfig = useMemo(() => ({ ...rest.hierarchyConfig }), [rest.hierarchyConfig]);
  const componentId = useGuid();

  const idsCache = getClassificationsTreeIdsCache({
    getCache,
    getBaseIdsCache,
    imodel: activeView.iModel,
    hierarchyConfig,
    visibilityHandlerConfig,
  });

  const { visibilityHandlerFactory, onSearchPathsChanged } = useClassificationsCachedVisibility({
    activeView,
    idsCache,
    componentId,
  });

  const { getSearchPaths, definition } = useClassificationsTreeDefinitionInternal({
    imodels: useMemo(() => [activeView.iModel], [activeView.iModel]),
    hierarchyConfig,
    search: useMemo(() => (searchText ? { searchText, limit: searchLimit } : undefined), [searchText, searchLimit]),
    onSearchPathsChanged,
    visibilityHandlerConfig,
  });

  const [prevSearchText, setPrevSearchText] = useState(searchText);
  if (prevSearchText !== searchText) {
    setPrevSearchText(searchText);
    setSearchError(undefined);
  }

  const getPaths = useMemo<FunctionProps<typeof useTree>["getSearchPaths"]>(() => {
    if (!searchText || !getSearchPaths) {
      return undefined;
    }
    return async (props) => {
      try {
        return await getSearchPaths(props);
      } catch (e) {
        const newError = e instanceof SearchLimitExceededError ? "tooManySearchMatches" : "unknownSearchError";
        if (newError !== "tooManySearchMatches") {
          const feature = e instanceof Error && e.message.includes("query too long to execute or server is too busy") ? "error-timeout" : "error-unknown";
          onFeatureUsed({ featureId: feature, reportInteraction: false });
        }
        setSearchError(newError);
        return [];
      }
    };
  }, [searchText, getSearchPaths, onFeatureUsed]);

  return {
    treeProps: {
      treeName: ClassificationsTreeComponent.id,
      getHierarchyDefinition: useCallback(() => definition, [definition]),
      visibilityHandlerFactory,
      getSearchPaths: getPaths,
      emptyTreeContent: useMemo(() => getEmptyTreeContentComponent(searchText, searchError, emptyTreeContent), [searchText, searchError, emptyTreeContent]),
      highlightText: searchText,
    },
    getTreeItemProps: (node, rendererProps) => ({
      ...rendererProps.getTreeItemProps?.(node),
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

/** @internal */
export function getClassificationsTreeIdsCache({
  getBaseIdsCache,
  getCache,
  imodel,
  hierarchyConfig,
  visibilityHandlerConfig,
}: {
  getCache: ReturnType<typeof useSharedTreeContextInternal>["getCache"];
  getBaseIdsCache: ReturnType<typeof useSharedTreeContextInternal>["getBaseIdsCache"];
  imodel: IModelConnection;
  hierarchyConfig: HierarchyConfigForClassificationsCache;
  visibilityHandlerConfig?: VisibilityHandlerConfigForClassificationsCache;
}) {
  const hierarchyConfigKey = hierarchyConfig.rootClassificationSystemCode;
  const visibilityHandlerConfigKey = visibilityHandlerConfig?.classificationToCategoriesRelationshipSpecification
    ? `${visibilityHandlerConfig.classificationToCategoriesRelationshipSpecification.fullClassName};${visibilityHandlerConfig.classificationToCategoriesRelationshipSpecification.source}`
    : "default";
  const cacheKey = `${hierarchyConfigKey}-${visibilityHandlerConfigKey}-ClassificationsTreeIdsCache`;
  return getCache({
    imodel,
    createCache: () =>
      new ClassificationsTreeIdsCache({
        baseIdsCache: getBaseIdsCache({ type: "3d", elementClassName: getClassesByView("3d").elementClass, imodel }),
        hierarchyConfig,
        queryExecutor: createECSqlQueryExecutor(imodel),
        visibilityHandlerConfig,
      }),
    cacheKey,
  });
}
