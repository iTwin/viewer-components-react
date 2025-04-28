/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@itwin/itwinui-react/bricks";
import {
  EmptyTreeContent,
  FilterUnknownError,
  NoFilterMatches,
  TooManyFilterMatches,
  TooManyInstancesFocused,
  UnknownInstanceFocusError,
} from "../common/components/EmptyTree.js";
import { ModelsTreeNode } from "./internal/ModelsTreeNode.js";
import { createModelsTreeVisibilityHandler } from "./internal/ModelsTreeVisibilityHandler.js";
import { useFilteredPaths } from "./internal/UseFilteredPaths.js";
import { useIdsCache } from "./internal/UseIdsCache.js";
import { defaultHierarchyConfiguration, ModelsTreeDefinition } from "./ModelsTreeDefinition.js";

import type { ModelsTreeIdsCache } from "./internal/ModelsTreeIdsCache.js";
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
  filter?: string;
  activeView: Viewport;
  hierarchyConfig?: Partial<ModelsTreeHierarchyConfiguration>;
  visibilityHandlerOverrides?: ModelsTreeVisibilityHandlerOverrides;
  getFilteredPaths?: (props: {
    createInstanceKeyPaths: (props: { targetItems: Array<InstanceKey | ElementsGroupInfo> } | { label: string }) => Promise<HierarchyFilteringPath[]>;
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

  const { getModelsTreeIdsCache, visibilityHandlerFactory, onFilteredPathsChanged } = useCachedVisibility(
    activeView,
    hierarchyConfiguration,
    visibilityHandlerOverrides,
  );

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
  activeView: Viewport,
  idsCacheGetter: () => ModelsTreeIdsCache,
  overrides?: ModelsTreeVisibilityHandlerOverrides,
  filteredPaths?: HierarchyFilteringPath[],
): VisibilityTreeProps["visibilityHandlerFactory"] {
  return ({ imodelAccess }) => createModelsTreeVisibilityHandler({ viewport: activeView, idsCache: idsCacheGetter(), imodelAccess, overrides, filteredPaths });
}

function useCachedVisibility(activeView: Viewport, hierarchyConfig: ModelsTreeHierarchyConfiguration, overrides?: ModelsTreeVisibilityHandlerOverrides) {
  const { getCache: getModelsTreeIdsCache } = useIdsCache(activeView.iModel, hierarchyConfig);
  const [filteredPaths, setFilteredPaths] = useState<HierarchyFilteringPath[]>();
  const [visibilityHandlerFactory, setVisibilityHandlerFactory] = useState<VisibilityTreeProps["visibilityHandlerFactory"]>(() =>
    createVisibilityHandlerFactory(activeView, getModelsTreeIdsCache, overrides, filteredPaths),
  );

  useEffect(() => {
    setVisibilityHandlerFactory(() => createVisibilityHandlerFactory(activeView, getModelsTreeIdsCache, overrides, filteredPaths));
  }, [activeView, getModelsTreeIdsCache, overrides, filteredPaths]);

  return {
    getModelsTreeIdsCache,
    visibilityHandlerFactory,
    onFilteredPathsChanged: useCallback((paths: HierarchyFilteringPath[] | undefined) => setFilteredPaths(paths), []),
  };
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

const subjectSvg = new URL("@itwin/itwinui-icons/bis-subject.svg", import.meta.url).href;
const classSvg = new URL("@itwin/itwinui-icons/bis-class.svg", import.meta.url).href;
const modelSvg = new URL("@itwin/itwinui-icons/model-cube.svg", import.meta.url).href;
const categorySvg = new URL("@itwin/itwinui-icons/bis-category-3d.svg", import.meta.url).href;
const elementSvg = new URL("@itwin/itwinui-icons/bis-element.svg", import.meta.url).href;

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
