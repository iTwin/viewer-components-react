/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@itwin/itwinui-react/bricks";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { HierarchyNodeIdentifier, HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import {
  EmptyTreeContent,
  FilterUnknownError,
  NoFilterMatches,
  TooManyFilterMatches,
  TooManyInstancesFocused,
  UnknownInstanceFocusError,
} from "../common/components/EmptyTree.js";
import { useFocusedInstancesContext } from "../common/FocusedInstancesContext.js";
import { GEOMETRIC_MODEL_3D_CLASS_NAME, SUBJECT_CLASS_NAME } from "../common/internal/ClassNameDefinitions.js";
import { useIModelChangeListener } from "../common/internal/UseIModelChangeListener.js";
import { FilterLimitExceededError } from "../common/TreeErrors.js";
import { useTelemetryContext } from "../common/UseTelemetryContext.js";
import { ModelsTreeIdsCache } from "./internal/ModelsTreeIdsCache.js";
import { ModelsTreeNode } from "./internal/ModelsTreeNode.js";
import { createModelsTreeVisibilityHandler } from "./internal/ModelsTreeVisibilityHandler.js";
import { defaultHierarchyConfiguration, ModelsTreeDefinition } from "./ModelsTreeDefinition.js";

import type { ReactNode } from "react";
import type { GroupingHierarchyNode, HierarchyFilteringPath, InstancesNodeKey } from "@itwin/presentation-hierarchies";
import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { ECClassHierarchyInspector, InstanceKey } from "@itwin/presentation-shared";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { ClassGroupingHierarchyNode, ElementsGroupInfo, ModelsTreeHierarchyConfiguration } from "./ModelsTreeDefinition.js";
import type { ModelsTreeVisibilityHandlerOverrides } from "./internal/ModelsTreeVisibilityHandler.js";
import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";
import type { VisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer.js";

type ModelsTreeFilteringError = "tooManyFilterMatches" | "tooManyInstancesFocused" | "unknownFilterError" | "unknownInstanceFocusError";

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
  const [filteringError, setFilteringError] = useState<ModelsTreeFilteringError | undefined>(undefined);
  const hierarchyConfiguration = useMemo<ModelsTreeHierarchyConfiguration>(
    () => ({
      ...defaultHierarchyConfiguration,
      ...hierarchyConfig,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    Object.values(hierarchyConfig ?? {}),
  );
  const { onFeatureUsed } = useTelemetryContext();

  const { getModelsTreeIdsCache, visibilityHandlerFactory, onFilteredPathsChanged } = useCachedVisibility(
    activeView,
    hierarchyConfiguration,
    visibilityHandlerOverrides,
  );
  const { loadFocusedItems } = useFocusedInstancesContext();

  const getHierarchyDefinition = useCallback<VisibilityTreeProps["getHierarchyDefinition"]>(
    ({ imodelAccess }) => new ModelsTreeDefinition({ imodelAccess, idsCache: getModelsTreeIdsCache(), hierarchyConfig: hierarchyConfiguration }),
    [getModelsTreeIdsCache, hierarchyConfiguration],
  );

  const getPaths = useMemo<VisibilityTreeProps["getFilteredPaths"] | undefined>(() => {
    setFilteringError(undefined);
    onModelsFiltered?.(undefined);

    // reset filtered paths if there is no filters applied. This allows to keep current filtered paths until new paths are loaded.
    if (!loadFocusedItems && !getFilteredPaths && !filter) {
      onFilteredPathsChanged(undefined);
    }

    const handlePaths = async (filteredPaths: HierarchyFilteringPath[], classInspector: ECClassHierarchyInspector) => {
      onFilteredPathsChanged(filteredPaths);
      if (!onModelsFiltered) {
        return;
      }

      const modelIds = await getModels(filteredPaths, getModelsTreeIdsCache(), classInspector);
      onModelsFiltered(modelIds);
    };

    if (loadFocusedItems) {
      return async ({ imodelAccess }) => {
        try {
          const focusedItems = await collectFocusedItems(loadFocusedItems);
          const paths = await ModelsTreeDefinition.createInstanceKeyPaths({
            imodelAccess,
            idsCache: getModelsTreeIdsCache(),
            targetItems: focusedItems,
            hierarchyConfig: hierarchyConfiguration,
          });
          void handlePaths(paths, imodelAccess);
          return paths.map((path) => ("path" in path ? path : { path, options: { autoExpand: true } }));
        } catch (e) {
          const newError = e instanceof FilterLimitExceededError ? "tooManyInstancesFocused" : "unknownInstanceFocusError";
          if (newError !== "tooManyInstancesFocused") {
            const feature = e instanceof Error && e.message.includes("query too long to execute or server is too busy") ? "error-timeout" : "error-unknown";
            onFeatureUsed({ featureId: feature, reportInteraction: false });
          }
          setFilteringError(newError);
          return [];
        }
      };
    }

    if (getFilteredPaths) {
      return async ({ imodelAccess }) => {
        try {
          const paths = await getFilteredPaths({
            createInstanceKeyPaths: async (props) =>
              ModelsTreeDefinition.createInstanceKeyPaths({
                ...props,
                imodelAccess,
                idsCache: getModelsTreeIdsCache(),
                hierarchyConfig: hierarchyConfiguration,
                limit: "unbounded",
              }),
          });
          void handlePaths(paths, imodelAccess);
          return paths;
        } catch (e) {
          const newError = e instanceof FilterLimitExceededError ? "tooManyFilterMatches" : "unknownFilterError";
          if (newError !== "tooManyFilterMatches") {
            const feature = e instanceof Error && e.message.includes("query too long to execute or server is too busy") ? "error-timeout" : "error-unknown";
            onFeatureUsed({ featureId: feature, reportInteraction: false });
          }
          setFilteringError(newError);
          return [];
        }
      };
    }

    if (filter) {
      return async ({ imodelAccess }) => {
        onFeatureUsed({ featureId: "filtering", reportInteraction: true });
        try {
          const paths = await ModelsTreeDefinition.createInstanceKeyPaths({
            imodelAccess,
            label: filter,
            idsCache: getModelsTreeIdsCache(),
            hierarchyConfig: hierarchyConfiguration,
          });
          void handlePaths(paths, imodelAccess);
          return paths.map((path) => ("path" in path ? path : { path, options: { autoExpand: true } }));
        } catch (e) {
          const newError = e instanceof FilterLimitExceededError ? "tooManyFilterMatches" : "unknownFilterError";
          if (newError !== "tooManyFilterMatches") {
            const feature = e instanceof Error && e.message.includes("query too long to execute or server is too busy") ? "error-timeout" : "error-unknown";
            onFeatureUsed({ featureId: feature, reportInteraction: false });
          }
          setFilteringError(newError);
          return [];
        }
      };
    }
    return undefined;
  }, [filter, loadFocusedItems, getModelsTreeIdsCache, onFeatureUsed, getFilteredPaths, hierarchyConfiguration, onModelsFiltered, onFilteredPathsChanged]);

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
      emptyTreeContent: getEmptyTreeContentComponent(filter, filteringError, emptyTreeContent),
      highlight: filter ? { text: filter } : undefined,
      selectionPredicate: nodeSelectionPredicate,
    },
    rendererProps: {
      // onDoubleClick,
      getDecorations: (node) => <ModelsTreeIcon node={node} />,
    },
  };
}

async function getModels(paths: HierarchyFilteringPath[], idsCache: ModelsTreeIdsCache, classInspector: ECClassHierarchyInspector) {
  if (!paths) {
    return undefined;
  }

  const targetModelIds = new Set<Id64String>();
  const targetSubjectIds = new Set<Id64String>();
  for (const path of paths) {
    const currPath = Array.isArray(path) ? path : path.path;
    for (let i = 0; i < currPath.length; i++) {
      const currStep = currPath[i];
      if (!HierarchyNodeIdentifier.isInstanceNodeIdentifier(currStep)) {
        break;
      }

      // if paths end with subject need to get all models under that subject
      if (i === currPath.length - 1 && currStep.className === SUBJECT_CLASS_NAME) {
        targetSubjectIds.add(currStep.id);
        break;
      }

      // collect all the models from the filtered path
      if (await classInspector.classDerivesFrom(currStep.className, GEOMETRIC_MODEL_3D_CLASS_NAME)) {
        targetModelIds.add(currStep.id);
      }
    }
  }

  const matchingModels = await idsCache.getSubjectModelIds([...targetSubjectIds]);
  return [...targetModelIds, ...matchingModels];
}

function getEmptyTreeContentComponent(filter?: string, error?: ModelsTreeFilteringError, emptyTreeContent?: React.ReactNode) {
  if (isInstanceFocusError(error)) {
    return <InstanceFocusError error={error!} />;
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

function isInstanceFocusError(error: ModelsTreeFilteringError | undefined) {
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
  if (node.extendedData?.imageId === undefined) {
    return undefined;
  }

  const getIcon = () => {
    switch (node.extendedData!.imageId) {
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

function createVisibilityHandlerFactory(
  activeView: Viewport,
  idsCacheGetter: () => ModelsTreeIdsCache,
  overrides?: ModelsTreeVisibilityHandlerOverrides,
  filteredPaths?: HierarchyFilteringPath[],
): VisibilityTreeProps["visibilityHandlerFactory"] {
  return ({ imodelAccess }) => createModelsTreeVisibilityHandler({ viewport: activeView, idsCache: idsCacheGetter(), imodelAccess, overrides, filteredPaths });
}

function useIdsCache(imodel: IModelConnection, hierarchyConfig: ModelsTreeHierarchyConfiguration) {
  const cacheRef = useRef<ModelsTreeIdsCache | undefined>(undefined);
  const clearCacheRef = useRef(() => {
    cacheRef.current?.[Symbol.dispose]?.();
    cacheRef.current = undefined;
  });
  const createCacheGetterRef = useRef((currImodel: IModelConnection, currHierarchyConfig: ModelsTreeHierarchyConfiguration) => {
    return () => {
      if (cacheRef.current === undefined) {
        cacheRef.current = new ModelsTreeIdsCache(createECSqlQueryExecutor(currImodel), currHierarchyConfig);
      }
      return cacheRef.current;
    };
  });
  const [getCache, setCacheGetter] = useState<() => ModelsTreeIdsCache>(() => createCacheGetterRef.current(imodel, hierarchyConfig));

  useEffect(() => {
    // clear cache in case it was created before `useEffect` was run first time
    clearCacheRef.current();

    // make sure all cache users rerender
    setCacheGetter(() => createCacheGetterRef.current(imodel, hierarchyConfig));
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      clearCacheRef.current();
    };
  }, [imodel, hierarchyConfig]);

  useIModelChangeListener({
    imodel,
    action: useCallback(() => {
      clearCacheRef.current();
      // make sure all cache users rerender
      setCacheGetter(() => createCacheGetterRef.current(imodel, hierarchyConfig));
    }, [imodel, hierarchyConfig]),
  });

  return {
    getCache,
  };
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

async function collectFocusedItems(loadFocusedItems: () => AsyncIterableIterator<InstanceKey | GroupingHierarchyNode>) {
  const focusedItems: Array<InstanceKey | ElementsGroupInfo> = [];
  const groupingNodeInfos: Array<{
    parentKey: InstancesNodeKey;
    parentType: "element" | "category";
    groupingNode: ClassGroupingHierarchyNode;
    modelIds: Id64Array;
  }> = [];
  for await (const key of loadFocusedItems()) {
    if ("id" in key) {
      focusedItems.push(key);
      continue;
    }

    if (!HierarchyNodeKey.isClassGrouping(key.key)) {
      continue;
    }

    const groupingNode = key as ClassGroupingHierarchyNode;
    if (!groupingNode.nonGroupingAncestor || !HierarchyNodeKey.isInstances(groupingNode.nonGroupingAncestor.key)) {
      continue;
    }

    const parentKey = groupingNode.nonGroupingAncestor.key;
    const type = groupingNode.nonGroupingAncestor.extendedData?.isCategory ? "category" : "element";
    const modelIds = ((groupingNode.nonGroupingAncestor.extendedData?.modelIds as Id64String[][]) ?? []).flatMap((ids) => ids);
    groupingNodeInfos.push({ groupingNode, parentType: type, parentKey, modelIds });
  }
  focusedItems.push(
    ...groupingNodeInfos.map(({ parentKey, parentType, groupingNode, modelIds }) => ({
      parent:
        parentType === "element"
          ? { type: "element" as const, ids: parentKey.instanceKeys.map((key) => key.id) }
          : { type: "category" as const, ids: parentKey.instanceKeys.map((key) => key.id), modelIds },
      groupingNode,
    })),
  );
  return focusedItems;
}
