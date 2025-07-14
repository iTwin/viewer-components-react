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
  TooManyFilterMatches,
  TooManyInstancesFocused,
  UnknownInstanceFocusError,
} from "../common/components/EmptyTree.js";
import { useCachedVisibility } from "../common/internal/useTreeHooks/UseCachedVisibility.js";
import { useIdsCache } from "../common/internal/useTreeHooks/UseIdsCache.js";
import { ModelsTreeIdsCache } from "./internal/ModelsTreeIdsCache.js";
import { ModelsTreeNode } from "./internal/ModelsTreeNode.js";
import { createModelsTreeVisibilityHandler } from "./internal/ModelsTreeVisibilityHandler.js";
import { useFilteredPaths } from "./internal/UseFilteredPaths.js";
import { defaultHierarchyConfiguration, ModelsTreeDefinition } from "./ModelsTreeDefinition.js";

import type { UseIdsCacheProps } from "../common/internal/useTreeHooks/UseIdsCache.js";
import type { UseCachedVisibilityProps } from "../common/internal/useTreeHooks/UseCachedVisibility.js";
import type { ReactNode } from "react";
import type { HierarchyFilteringPath } from "@itwin/presentation-hierarchies";
import type { Id64String } from "@itwin/core-bentley";
import type { InstanceKey } from "@itwin/presentation-shared";
import type { Viewport } from "@itwin/core-frontend";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { ElementsGroupInfo, ModelsTreeHierarchyConfiguration } from "./ModelsTreeDefinition.js";
import type { ModelsTreeVisibilityHandlerOverrides } from "./internal/ModelsTreeVisibilityHandler.js";
import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";
import type { VisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer.js";
import type { ModelsTreeFilteringError } from "./internal/UseFilteredPaths.js";

/** @beta */
export interface UseModelsTreeProps {
  /**
   * Optional search string used to filter tree nodes by label, as well as highlight matching substrings in the tree.
   * Nodes that do not contain this string in their label will be filtered out.
   *
   * If `getFilteredPaths` function is provided, it will take precedence and automatic filtering by this string will not be applied.
   * Instead, the string will be supplied to the given `getFilteredPaths` function for consumers to apply the filtering.
   */
  filter?: string;
  activeView: Viewport;
  hierarchyConfig?: Partial<ModelsTreeHierarchyConfiguration>;
  visibilityHandlerOverrides?: ModelsTreeVisibilityHandlerOverrides;
  /**
   * Optional function for applying custom filtering on the hierarchy. Use it when you want full control over which nodes should be displayed, based on more complex logic or known instance keys.
   *
   * When defined, this function takes precedence over filtering by `filter` string. If both are supplied, the `filter` is provided as an argument to `getFilteredPaths`.
   *
   * @param props Parameters provided when `getFilteredPaths` is called:
   * - `createInstanceKeyPaths`: Helper function to create filter paths.
   * - `filter`: The filter string which would otherwise be used for default filtering.
   *
   * **Example use cases:**
   * - You have a list of `InstanceKey` items, which you want to use for filtering the hierarchy.
   * - You want to create filter paths based on node label, but also apply some extra conditions (for example exclude paths with sub-models).
   * - You want to construct custom filtered paths. For example: create a filter path for each geometric element which has a parent element.
   *
   * @note Paths returned  by `createInstanceKeyPaths` will not have `autoExpand` flag set. If you want nodes to be expanded, iterate over the paths and
   * set `autoExpand: true` manually.
   */
  getFilteredPaths?: (props: {
    /** A function that creates filtering paths based on provided target instance keys or node label. */
    createInstanceKeyPaths: (props: { targetItems: Array<InstanceKey | ElementsGroupInfo> } | { label: string }) => Promise<HierarchyFilteringPath[]>;
    /** Filter which would be used to create filter paths if `getFilteredPaths` wouldn't be provided. */
    filter?: string;
  }) => Promise<HierarchyFilteringPath[]>;
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
    "treeName" | "getHierarchyDefinition" | "getFilteredPaths" | "visibilityHandlerFactory" | "highlight" | "emptyTreeContent" | "selectionPredicate"
  >;
  rendererProps: Required<Pick<VisibilityTreeRendererProps, "getDecorations">>;
}

/**
 * Custom hook to create and manage state for the models tree.
 * @beta
 */
export function useModelsTree({
  activeView,
  filter,
  hierarchyConfig,
  visibilityHandlerOverrides,
  getFilteredPaths,
  onModelsFiltered,
  selectionPredicate: nodeTypeSelectionPredicate,
  emptyTreeContent,
}: UseModelsTreeProps): UseModelsTreeResult {
  const hierarchyConfiguration = useMemo<ModelsTreeHierarchyConfiguration>(
    () => ({
      ...defaultHierarchyConfiguration,
      ...hierarchyConfig,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    Object.values(hierarchyConfig ?? {}),
  );
  const { getCache: getModelsTreeIdsCache } = useIdsCache<ModelsTreeIdsCache, { hierarchyConfig: ModelsTreeHierarchyConfiguration }>({
    imodel: activeView.iModel,
    createCache,
    cacheSpecificProps: useMemo(() => ({ hierarchyConfig: hierarchyConfiguration }), [hierarchyConfiguration]),
  });

  const { visibilityHandlerFactory, onFilteredPathsChanged } = useCachedVisibility<ModelsTreeIdsCache, { overrides?: ModelsTreeVisibilityHandlerOverrides }>({
    activeView,
    createFactory: createVisibilityHandlerFactory,
    factoryProps: useMemo(() => ({ overrides: visibilityHandlerOverrides }), [visibilityHandlerOverrides]),
    getCache: getModelsTreeIdsCache,
  });

  const getHierarchyDefinition = useCallback<VisibilityTreeProps["getHierarchyDefinition"]>(
    ({ imodelAccess }) => new ModelsTreeDefinition({ imodelAccess, idsCache: getModelsTreeIdsCache(), hierarchyConfig: hierarchyConfiguration }),
    [getModelsTreeIdsCache, hierarchyConfiguration],
  );

  const { getPaths, filteringError } = useFilteredPaths({
    hierarchyConfiguration,
    filter,
    getFilteredPaths,
    getModelsTreeIdsCache,
    onFilteredPathsChanged,
    onModelsFiltered,
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
      getFilteredPaths: getPaths,
      emptyTreeContent: useMemo(() => getEmptyTreeContentComponent(filter, filteringError, emptyTreeContent), [filter, filteringError, emptyTreeContent]),
      highlight: useMemo(() => (filter ? { text: filter } : undefined), [filter]),
      selectionPredicate: nodeSelectionPredicate,
    },
    rendererProps: {
      // onDoubleClick,
      getDecorations: useCallback((node) => <ModelsTreeIcon node={node} />, []),
    },
  };
}

function createVisibilityHandlerFactory(
  props: Parameters<UseCachedVisibilityProps<ModelsTreeIdsCache, { overrides?: ModelsTreeVisibilityHandlerOverrides }>["createFactory"]>[0],
): VisibilityTreeProps["visibilityHandlerFactory"] {
  const { activeView, idsCacheGetter, filteredPaths, factoryProps } = props;
  return ({ imodelAccess }) =>
    createModelsTreeVisibilityHandler({
      viewport: activeView,
      idsCache: idsCacheGetter(),
      imodelAccess,
      overrides: factoryProps.overrides,
      filteredPaths,
    });
}

function getEmptyTreeContentComponent(filter?: string, error?: ModelsTreeFilteringError, emptyTreeContent?: React.ReactNode) {
  if (isInstanceFocusError(error)) {
    return <InstanceFocusError error={error} />;
  }
  if (isFilterError(error)) {
    if (error === "tooManyFilterMatches") {
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

function isFilterError(error: ModelsTreeFilteringError | undefined) {
  return error === "tooManyFilterMatches" || error === "unknownFilterError";
}

function isInstanceFocusError(error: ModelsTreeFilteringError | undefined): error is "tooManyInstancesFocused" | "unknownInstanceFocusError" {
  return error === "tooManyInstancesFocused" || error === "unknownInstanceFocusError";
}

function InstanceFocusError({ error }: { error: ModelsTreeFilteringError }) {
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

function createCache(...props: Parameters<UseIdsCacheProps<ModelsTreeIdsCache, { hierarchyConfig: ModelsTreeHierarchyConfiguration }>["createCache"]>) {
  return new ModelsTreeIdsCache(createECSqlQueryExecutor(props[0]), props[1].hierarchyConfig);
}
