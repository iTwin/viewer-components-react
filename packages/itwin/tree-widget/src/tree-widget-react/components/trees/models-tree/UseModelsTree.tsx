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
  NoSearchMatches,
  SearchUnknownError,
  SubTreeError,
  TooManyInstancesFocused,
  TooManySearchMatches,
  UnknownInstanceFocusError,
} from "../common/components/EmptyTree.js";
import { useSharedTreeContextInternal } from "../common/internal/SharedTreeWidgetContextProviderInternal.js";
import { useGuid } from "../common/internal/useGuid.js";
import { useCachedVisibility } from "../common/internal/useTreeHooks/UseCachedVisibility.js";
import { ModelsTreeIdsCache } from "./internal/ModelsTreeIdsCache.js";
import { useSearchPaths } from "./internal/UseSearchPaths.js";
import { ModelsTreeVisibilityHandler } from "./internal/visibility/ModelsTreeVisibilityHandler.js";
import { createModelsSearchResultsTree } from "./internal/visibility/SearchResultsTree.js";
import { defaultHierarchyConfiguration, ModelsTreeDefinition } from "./ModelsTreeDefinition.js";
import { ModelsTreeNode } from "./ModelsTreeNode.js";

import type { ReactNode } from "react";
import type { GuidString, Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { HierarchySearchPath } from "@itwin/presentation-hierarchies";
import type { TreeNode } from "@itwin/presentation-hierarchies-react";
import type { InstanceKey } from "@itwin/presentation-shared";
import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";
import type { ExtendedVisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer.js";
import type { CreateSearchResultsTreeProps, CreateTreeSpecificVisibilityHandlerProps } from "../common/internal/useTreeHooks/UseCachedVisibility.js";
import type { SearchResultsTree } from "../common/internal/visibility/BaseSearchResultsTree.js";
import type { TreeWidgetViewport } from "../common/TreeWidgetViewport.js";
import type { NormalizedHierarchySearchPath } from "../common/Utils.js";
import type { ModelsTreeSearchError, ModelsTreeSubTreeError } from "./internal/UseSearchPaths.js";
import type { ModelsTreeVisibilityHandlerOverrides } from "./internal/visibility/ModelsTreeVisibilityHandler.js";
import type { ModelsTreeSearchTargets } from "./internal/visibility/SearchResultsTree.js";
import type { ElementsGroupInfo, ModelsTreeHierarchyConfiguration } from "./ModelsTreeDefinition.js";

/** @beta */
export interface UseModelsTreeProps {
  /**
   * Optional search string used to filter tree nodes by label, as well as highlight matching substrings in the tree.
   * Nodes that do not contain this string in their label will be filtered out.
   *
   * If `getSearchPaths` function is provided, it will take precedence and automatic search by this string will not be applied.
   * Instead, the string will be supplied to the given `getSearchPaths` function for consumers to apply the search.
   */
  searchText?: string;
  activeView: TreeWidgetViewport;
  hierarchyConfig?: Partial<ModelsTreeHierarchyConfiguration>;
  visibilityHandlerOverrides?: ModelsTreeVisibilityHandlerOverrides;
  /**
   * Optional function for applying custom search on the hierarchy. Use it when you want full control over which nodes should be displayed, based on more complex logic or known instance keys.
   *
   * When defined, this function takes precedence over search by `searchText` string. If both are supplied, the `searchText` is provided as an argument to `getSearchPaths`.
   *
   * @param props Parameters provided when `getSearchPaths` is called:
   * - `createInstanceKeyPaths`: Helper function to create search paths.
   * - `searchText`: The search text which would otherwise be used for default searching.
   *
   * **Example use cases:**
   * - You have a list of `InstanceKey` items, which you want to use for searching the hierarchy.
   * - You want to create search paths based on node label, but also apply some extra conditions (for example exclude paths with sub-models).
   * - You want to construct custom search paths. For example: create a search path for each geometric element which has a parent element.
   *
   * @note Paths returned  by `createInstanceKeyPaths` will not have `reveal` flag set. If you want nodes to be expanded, iterate over the paths and
   * set `reveal: true` manually.
   */
  getSearchPaths?: (props: {
    /** A function that creates search paths based on provided target instance keys or node label. */
    createInstanceKeyPaths: (props: { targetItems: Array<InstanceKey | ElementsGroupInfo> } | { label: string }) => Promise<NormalizedHierarchySearchPath[]>;
    /** Search text which would be used to create search paths if `getSearchPaths` wouldn't be provided. */
    searchText?: string;
  }) => Promise<HierarchySearchPath[] | undefined>;
  /**
   * Optional function for restricting the visible hierarchy to a specific sub-tree of nodes, without changing how search works.
   *
   * Use when you want to display only part of the hierarchy, but still allow normal searching within that sub-tree.
   *
   * When defined, only nodes that are in the provided paths or children of target nodes will be part of the hierarchy.
   * Searching (by label or custom logic) will still apply within this sub-tree.
   *
   * Key difference:
   * - `getSearchPaths` determines which nodes should be shown, giving you full control over search logic.
   * - `getSubTreePaths` restricts the hierarchy to a sub-tree, but does not override the search logic — search is still applied within the restricted sub-tree.
   */
  getSubTreePaths?: (props: {
    /** A function that creates search paths based on provided target instance keys. */
    createInstanceKeyPaths: (props: { targetItems: Array<InstanceKey | ElementsGroupInfo> }) => Promise<NormalizedHierarchySearchPath[]>;
  }) => Promise<HierarchySearchPath[]>;
  onModelsFiltered?: (modelIds: Id64String[] | undefined) => void;
  /**
   * An optional predicate to allow or prohibit selection of a node.
   * When not supplied, all nodes are selectable.
   */
  selectionPredicate?: (props: { node: TreeNode; type: "subject" | "model" | "category" | "element" | "elements-class-group" }) => boolean;
  emptyTreeContent?: ReactNode;
  getTreeItemProps?: ExtendedVisibilityTreeRendererProps["getTreeItemProps"];
}

/** @beta */
interface UseModelsTreeResult {
  treeProps: Pick<
    VisibilityTreeProps,
    "treeName" | "getHierarchyDefinition" | "getSearchPaths" | "visibilityHandlerFactory" | "highlightText" | "emptyTreeContent" | "selectionPredicate"
  >;
  getTreeItemProps: Required<ExtendedVisibilityTreeRendererProps>["getTreeItemProps"];
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
  getTreeItemProps,
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
  const idsCache = useModelsTreeIdsCache({
    imodel: activeView.iModel,
    hierarchyConfig: hierarchyConfiguration,
    componentId,
  });

  const { visibilityHandlerFactory, onSearchPathsChanged } = useCachedVisibility<ModelsTreeIdsCache, ModelsTreeSearchTargets>({
    activeView,
    createSearchResultsTree,
    createTreeSpecificVisibilityHandler: useCallback(
      (treeProps) => createTreeSpecificVisibilityHandler({ ...treeProps, overrides: visibilityHandlerOverrides }),
      [visibilityHandlerOverrides],
    ),
    idsCache,
    componentId,
  });

  const getHierarchyDefinition = useCallback<VisibilityTreeProps["getHierarchyDefinition"]>(
    ({ imodelAccess }) => new ModelsTreeDefinition({ imodelAccess, idsCache, hierarchyConfig: hierarchyConfiguration, componentId }),
    [idsCache, hierarchyConfiguration, componentId],
  );

  const { getPaths, searchError, subTreeError } = useSearchPaths({
    hierarchyConfiguration,
    searchText,
    getSearchPaths,
    idsCache,
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
    treeProps: {
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
    getTreeItemProps: (node, rendererProps) => ({
      ...rendererProps.getTreeItemProps?.(node),
      decorations: <ModelsTreeIcon node={node} />,
      ...getTreeItemProps?.(node, rendererProps),
    }),
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
  const { info, idsCache, overrideHandler, overrides, viewport } = props;
  return new ModelsTreeVisibilityHandler({
    alwaysAndNeverDrawnElementInfo: info,
    overrideHandler,
    idsCache,
    viewport,
    overrides,
  });
}

function getEmptyTreeContentComponent(
  searchText?: string,
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
  if (isSearchError(error)) {
    if (error === "tooManySearchMatches") {
      return <TooManySearchMatches base={"modelsTree"} />;
    }
    return <SearchUnknownError base={"modelsTree"} />;
  }
  if (searchText) {
    return <NoSearchMatches base={"modelsTree"} />;
  }
  if (emptyTreeContent) {
    return emptyTreeContent;
  }
  return <EmptyTreeContent icon={modelSvg} />;
}

function isSubTreeError(error: ModelsTreeSubTreeError | undefined) {
  return error === "unknownSubTreeError";
}

function isSearchError(error: ModelsTreeSearchError | undefined) {
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
export function ModelsTreeIcon({ node }: { node: TreeNode }) {
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

function useModelsTreeIdsCache({
  imodel,
  componentId,
  hierarchyConfig,
}: {
  imodel: IModelConnection;
  hierarchyConfig: ModelsTreeHierarchyConfiguration;
  componentId: GuidString;
}): ModelsTreeIdsCache {
  const { getBaseIdsCache, getCache } = useSharedTreeContextInternal();
  const baseIdsCache = getBaseIdsCache({ type: "3d", elementClassName: hierarchyConfig.elementClassSpecification, imodel });

  const modelsTreeIdsCache = getCache({
    imodel,
    createCache: () => new ModelsTreeIdsCache({ baseIdsCache, componentId, hierarchyConfig, queryExecutor: createECSqlQueryExecutor(imodel) }),
    cacheKey: `${hierarchyConfig.elementClassSpecification}-ModelsTreeIdsCache`,
  });

  return modelsTreeIdsCache;
}
