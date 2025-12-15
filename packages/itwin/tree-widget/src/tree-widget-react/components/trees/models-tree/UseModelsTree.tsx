/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useMemo } from "react";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { Icon } from "@stratakit/foundations";
import categorySvg from "@stratakit/icons/bis-category-3d.svg";
import classSvg from "@stratakit/icons/bis-class.svg";
import elementSvg from "@stratakit/icons/bis-element.svg";
import subjectSvg from "@stratakit/icons/bis-subject.svg";
import modelSvg from "@stratakit/icons/model-cube.svg";
import {
  EmptyTreeContent,
  FilterUnknownError,
  NoFilterMatches,
  SubTreeError,
  TooManyFilterMatches,
  TooManyInstancesFocused,
  UnknownInstanceFocusError,
} from "../common/components/EmptyTree.js";
import { useGuid } from "../common/internal/useGuid.js";
import { useCachedVisibility } from "../common/internal/useTreeHooks/UseCachedVisibility.js";
import { useIdsCache } from "../common/internal/useTreeHooks/UseIdsCache.js";
import { ModelsTreeIdsCache } from "./internal/ModelsTreeIdsCache.js";
import { ModelsTreeNode } from "./internal/ModelsTreeNode.js";
import { useSearchPaths } from "./internal/UseSearchPaths.js";
import { createModelsSearchResultsTree } from "./internal/visibility/SearchResultsTree.js";
import { ModelsTreeVisibilityHandler } from "./internal/visibility/ModelsTreeVisibilityHandler.js";
import { defaultHierarchyConfiguration, ModelsTreeDefinition } from "./ModelsTreeDefinition.js";

import type { ReactNode } from "react";
import type { Id64String } from "@itwin/core-bentley";
import type { HierarchySearchPath } from "@itwin/presentation-hierarchies";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { InstanceKey } from "@itwin/presentation-shared";
import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";
import type { VisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer.js";
import type { CreateSearchResultsTreeProps, CreateTreeSpecificVisibilityHandlerProps } from "../common/internal/useTreeHooks/UseCachedVisibility.js";
import type { CreateCacheProps } from "../common/internal/useTreeHooks/UseIdsCache.js";
import type { SearchResultsTree } from "../common/internal/visibility/BaseSearchResultsTree.js";
import type { TreeWidgetViewport } from "../common/TreeWidgetViewport.js";
import type { NormalizedHierarchySearchPath } from "../common/Utils.js";
import type { ModelsTreeSearchError, ModelsTreeSubTreeError } from "./internal/UseSearchPaths.js";
import type { ModelsTreeSearchTargets } from "./internal/visibility/SearchResultsTree.js";
import type { ModelsTreeVisibilityHandlerOverrides } from "./internal/visibility/ModelsTreeVisibilityHandler.js";
import type { ElementsGroupInfo, ModelsTreeHierarchyConfiguration } from "./ModelsTreeDefinition.js";

/** @beta */
export interface UseModelsTreeProps {
  /**
   * Optional search string used to filter tree nodes by label, as well as highlight matching substrings in the tree.
   * Nodes that do not contain this string in their label will be filtered out.
   *
   * If `getSearchPaths` function is provided, it will take precedence and automatic filtering by this string will not be applied.
   * Instead, the string will be supplied to the given `getSearchPaths` function for consumers to apply the filtering.
   */
  searchText?: string;
  activeView: TreeWidgetViewport;
  hierarchyConfig?: Partial<ModelsTreeHierarchyConfiguration>;
  visibilityHandlerOverrides?: ModelsTreeVisibilityHandlerOverrides;
  /**
   * Optional function for applying custom filtering on the hierarchy. Use it when you want full control over which nodes should be displayed, based on more complex logic or known instance keys.
   *
   * When defined, this function takes precedence over filtering by `filter` string. If both are supplied, the `filter` is provided as an argument to `getSearchPaths`.
   *
   * @param props Parameters provided when `getSearchPaths` is called:
   * - `createInstanceKeyPaths`: Helper function to create filter paths.
   * - `filter`: The filter string which would otherwise be used for default filtering.
   *
   * **Example use cases:**
   * - You have a list of `InstanceKey` items, which you want to use for filtering the hierarchy.
   * - You want to create filter paths based on node label, but also apply some extra conditions (for example exclude paths with sub-models).
   * - You want to construct custom filtered paths. For example: create a filter path for each geometric element which has a parent element.
   *
   * @note Paths returned  by `createInstanceKeyPaths` will not have `reveal` flag set. If you want nodes to be expanded, iterate over the paths and
   * set `reveal: true` manually.
   */
  getSearchPaths?: (props: {
    /** A function that creates filtering paths based on provided target instance keys or node label. */
    createInstanceKeyPaths: (props: { targetItems: Array<InstanceKey | ElementsGroupInfo> } | { label: string }) => Promise<NormalizedHierarchySearchPath[]>;
    /** Search text which would be used to create search paths if `getSearchPaths` wouldn't be provided. */
    searchText?: string;
  }) => Promise<HierarchySearchPath[] | undefined>;
  /**
   * Optional function for restricting the visible hierarchy to a specific sub-tree of nodes, without changing how filtering works.
   *
   * Use when you want to display only part of the hierarchy, but still allow normal filtering within that sub-tree.
   *
   * When defined, only nodes that are in the provided paths or children of target nodes will be part of the hierarchy.
   * Filtering (by label or custom logic) will still apply within this sub-tree.
   *
   * Key difference:
   * - `getSearchPaths` determines which nodes should be shown, giving you full control over filtering logic.
   * - `getSubTreePaths` restricts the hierarchy to a sub-tree, but does not override the filtering logic — filtering is still applied within the restricted sub-tree.
   */
  getSubTreePaths?: (props: {
    /** A function that creates filtering paths based on provided target instance keys. */
    createInstanceKeyPaths: (props: { targetItems: Array<InstanceKey | ElementsGroupInfo> }) => Promise<NormalizedHierarchySearchPath[]>;
  }) => Promise<HierarchySearchPath[]>;
  onModelsFiltered?: (modelIds: Id64String[] | undefined) => void;
  /**
   * An optional predicate to allow or prohibit selection of a node.
   * When not supplied, all nodes are selectable.
   */
  selectionPredicate?: (props: { node: PresentationHierarchyNode; type: "subject" | "model" | "category" | "element" | "elements-class-group" }) => boolean;
  emptyTreeContent?: ReactNode;
}

/** @beta */
interface UseModelsTreeResult {
  modelsTreeProps: Pick<
    VisibilityTreeProps,
    "treeName" | "getHierarchyDefinition" | "getSearchPaths" | "visibilityHandlerFactory" | "highlightText" | "emptyTreeContent" | "selectionPredicate"
  >;
  rendererProps: Required<Pick<VisibilityTreeRendererProps, "getDecorations">>;
}

/**
 * Custom hook to create and manage state for the models tree.
 * @beta
 */
export function useModelsTree({
  activeView,
  searchText,
  hierarchyConfig,
  visibilityHandlerOverrides,
  getSearchPaths,
  onModelsFiltered,
  selectionPredicate: nodeTypeSelectionPredicate,
  emptyTreeContent,
  getSubTreePaths,
}: UseModelsTreeProps): UseModelsTreeResult {
  const hierarchyConfiguration = useMemo<ModelsTreeHierarchyConfiguration>(
    () => ({
      ...defaultHierarchyConfiguration,
      ...hierarchyConfig,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    Object.values(hierarchyConfig ?? {}),
  );
  const componentId = useGuid();
  const { getCache: getModelsTreeIdsCache } = useIdsCache<ModelsTreeIdsCache, { hierarchyConfig: ModelsTreeHierarchyConfiguration }>({
    imodel: activeView.iModel,
    createCache,
    cacheSpecificProps: useMemo(() => ({ hierarchyConfig: hierarchyConfiguration }), [hierarchyConfiguration]),
    componentId,
  });

  const { visibilityHandlerFactory, onSearchPathsChanged } = useCachedVisibility<ModelsTreeIdsCache, ModelsTreeSearchTargets>({
    activeView,
    createSearchResultsTree,
    createTreeSpecificVisibilityHandler: useCallback(
      (treeProps) => createTreeSpecificVisibilityHandler({ ...treeProps, overrides: visibilityHandlerOverrides }),
      [visibilityHandlerOverrides],
    ),
    getCache: getModelsTreeIdsCache,
    componentId,
  });

  const getHierarchyDefinition = useCallback<VisibilityTreeProps["getHierarchyDefinition"]>(
    ({ imodelAccess }) => new ModelsTreeDefinition({ imodelAccess, idsCache: getModelsTreeIdsCache(), hierarchyConfig: hierarchyConfiguration, componentId }),
    [getModelsTreeIdsCache, hierarchyConfiguration, componentId],
  );

  const { getPaths, searchError, subTreeError } = useSearchPaths({
    hierarchyConfiguration,
    searchText,
    getSearchPaths,
    getModelsTreeIdsCache,
    onSearchPathsChanged,
    onModelsFiltered,
    getSubTreePaths,
    componentId,
  });

  const nodeSelectionPredicate = useCallback<NonNullable<VisibilityTreeProps["selectionPredicate"]>>(
    (node) => {
      if (!nodeTypeSelectionPredicate) {
        return true;
      }
      return nodeTypeSelectionPredicate({ node, type: ModelsTreeNode.getType(node.nodeData) });
    },
    [nodeTypeSelectionPredicate],
  );

  // TODO: add double click logic
  return {
    modelsTreeProps: {
      treeName: "models-tree-v2",
      visibilityHandlerFactory,
      getHierarchyDefinition,
      getSearchPaths: getPaths,
      emptyTreeContent: useMemo(
        () => getEmptyTreeContentComponent(searchText, subTreeError, searchError, emptyTreeContent),
        [searchText, subTreeError, searchError, emptyTreeContent],
      ),
      highlightText: searchText,
      selectionPredicate: nodeSelectionPredicate,
    },
    rendererProps: {
      // onDoubleClick,
      getDecorations: useCallback((node) => <ModelsTreeIcon node={node} />, []),
    },
  };
}

async function createSearchResultsTree(props: CreateSearchResultsTreeProps<ModelsTreeIdsCache>): Promise<SearchResultsTree<ModelsTreeSearchTargets>> {
  const { searchPaths, imodelAccess } = props;
  return createModelsSearchResultsTree({
    imodelAccess,
    searchPaths,
  });
}

function createTreeSpecificVisibilityHandler(
  props: CreateTreeSpecificVisibilityHandlerProps<ModelsTreeIdsCache> & { overrides?: ModelsTreeVisibilityHandlerOverrides },
) {
  const { info, getCache, overrideHandler, overrides, viewport } = props;
  return new ModelsTreeVisibilityHandler({
    alwaysAndNeverDrawnElementInfo: info,
    overrideHandler,
    idsCache: getCache(),
    viewport,
    overrides,
  });
}

function getEmptyTreeContentComponent(
  filter?: string,
  subTreeError?: ModelsTreeSubTreeError,
  error?: ModelsTreeSearchError,
  emptyTreeContent?: React.ReactNode,
) {
  if (isSubTreeError(subTreeError)) {
    return <SubTreeError base={"modelsTree"} error={subTreeError} />;
  }
  if (isInstanceFocusError(error)) {
    return <InstanceFocusError error={error} />;
  }
  if (isFilterError(error)) {
    if (error === "tooManySearchMatches") {
      return <TooManyFilterMatches base={"modelsTree"} />;
    }
    return <FilterUnknownError base={"modelsTree"} />;
  }
  if (filter) {
    return <NoFilterMatches base={"modelsTree"} />;
  }
  if (emptyTreeContent) {
    return emptyTreeContent;
  }
  return <EmptyTreeContent icon={modelSvg} />;
}

function isSubTreeError(error: ModelsTreeSubTreeError | undefined) {
  return error === "unknownSubTreeError";
}

function isFilterError(error: ModelsTreeSearchError | undefined) {
  return error === "tooManySearchMatches" || error === "unknownSearchError";
}

function isInstanceFocusError(error: ModelsTreeSearchError | undefined): error is "tooManyInstancesFocused" | "unknownInstanceFocusError" {
  return error === "tooManyInstancesFocused" || error === "unknownInstanceFocusError";
}

function InstanceFocusError({ error }: { error: ModelsTreeSearchError }) {
  if (error === "tooManyInstancesFocused") {
    return <TooManyInstancesFocused base={"modelsTree"} />;
  }
  return <UnknownInstanceFocusError base={"modelsTree"} />;
}

/** @beta */
export function ModelsTreeIcon({ node }: { node: PresentationHierarchyNode }) {
  if (node.nodeData.extendedData?.imageId === undefined) {
    return undefined;
  }

  const getIcon = () => {
    switch (node.nodeData.extendedData!.imageId) {
      case "icon-layers":
        return categorySvg;
      case "icon-item":
        return elementSvg;
      case "icon-ec-class":
        return classSvg;
      case "icon-folder":
        return subjectSvg;
      case "icon-model":
        return modelSvg;
      default:
        return undefined;
    }
  };

  return <Icon href={getIcon()} />;
}

function createCache(props: CreateCacheProps<{ hierarchyConfig: ModelsTreeHierarchyConfiguration }>) {
  return new ModelsTreeIdsCache(createECSqlQueryExecutor(props.imodel), props.specificProps.hierarchyConfig, props.componentId);
}
