/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IModelApp } from "@itwin/core-frontend";
import { SvgFolder, SvgImodelHollow, SvgItem, SvgLayers, SvgModel } from "@itwin/itwinui-icons-react";
import { Anchor, Text } from "@itwin/itwinui-react";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { HierarchyFilteringPath, HierarchyNode, HierarchyNodeIdentifier, HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { TreeWidget } from "../../../TreeWidget.js";
import { useFocusedInstancesContext } from "../common/FocusedInstancesContext.js";
import { useIdsCache } from "../common/internal/useTreeHooks/UseIdsCache.js";
import { FilterLimitExceededError } from "../common/TreeErrors.js";
import { useGuid } from "../common/useGuid.js";
import { useTelemetryContext } from "../common/UseTelemetryContext.js";
import { joinHierarchyFilteringPaths } from "../common/Utils.js";
import { ModelsTreeIdsCache } from "./internal/ModelsTreeIdsCache.js";
import { ModelsTreeNode } from "./internal/ModelsTreeNode.js";
import { createModelsTreeVisibilityHandler } from "./internal/ModelsTreeVisibilityHandler.js";
import { defaultHierarchyConfiguration, ModelsTreeDefinition } from "./ModelsTreeDefinition.js";

import type { ReactElement } from "react";
import type { GuidString, Id64String } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { GroupingHierarchyNode, HierarchyNodeIdentifiersPath, InstancesNodeKey } from "@itwin/presentation-hierarchies";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { ECClassHierarchyInspector, InstanceKey } from "@itwin/presentation-shared";
import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";
import type { VisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer.js";
import type { CreateCacheProps } from "../common/internal/useTreeHooks/UseIdsCache.js";
import type { NormalizedHierarchyFilteringPath } from "../common/Utils.js";
import type { ModelsTreeVisibilityHandlerOverrides } from "./internal/ModelsTreeVisibilityHandler.js";
import type { ClassGroupingHierarchyNode, ElementsGroupInfo, ModelsTreeHierarchyConfiguration } from "./ModelsTreeDefinition.js";

type ModelsTreeFilteringError = "tooManyFilterMatches" | "tooManyInstancesFocused" | "unknownFilterError" | "unknownInstanceFocusError";
type ModelsTreeSubTreeError = "unknownSubTreeError";

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
    createInstanceKeyPaths: (props: { targetItems: Array<InstanceKey | ElementsGroupInfo> } | { label: string }) => Promise<NormalizedHierarchyFilteringPath[]>;
    /** Filter which would be used to create filter paths if `getFilteredPaths` wouldn't be provided. */
    filter?: string;
  }) => Promise<HierarchyFilteringPath[] | undefined>;
  /**
   * Optional function for restricting the visible hierarchy to a specific sub-tree of nodes, without changing how filtering works.
   *
   * Use when you want to display only part of the hierarchy, but still allow normal filtering within that sub-tree.
   *
   * When defined, only nodes that are in the provided paths or children of target nodes will be part of the hierarchy.
   * Filtering (by label or custom logic) will still apply within this sub-tree.
   *
   * Key difference:
   * - `getFilteredPaths` determines which nodes should be shown, giving you full control over filtering logic.
   * - `getSubTreePaths` restricts the hierarchy to a sub-tree, but does not override the filtering logic — filtering is still applied within the restricted sub-tree.
   */
  getSubTreePaths?: (props: {
    /** A function that creates filtering paths based on provided target instance keys. */
    createInstanceKeyPaths: (props: { targetItems: Array<InstanceKey | ElementsGroupInfo> }) => Promise<NormalizedHierarchyFilteringPath[]>;
  }) => Promise<HierarchyFilteringPath[]>;
  onModelsFiltered?: (modelIds: Id64String[] | undefined) => void;
  /**
   * An optional predicate to allow or prohibit selection of a node.
   * When not supplied, all nodes are selectable.
   */
  selectionPredicate?: (props: { node: PresentationHierarchyNode; type: "subject" | "model" | "category" | "element" | "elements-class-group" }) => boolean;
}

/** @beta */
interface UseModelsTreeResult {
  modelsTreeProps: Pick<
    VisibilityTreeProps,
    "treeName" | "getHierarchyDefinition" | "getFilteredPaths" | "visibilityHandlerFactory" | "highlight" | "noDataMessage" | "selectionPredicate"
  >;
  rendererProps: Required<Pick<VisibilityTreeRendererProps, "getIcon" | "onNodeDoubleClick">>;
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
  getSubTreePaths,
}: UseModelsTreeProps): UseModelsTreeResult {
  const [filteringError, setFilteringError] = useState<ModelsTreeFilteringError | undefined>(undefined);
  const [subTreeError, setSubTreeError] = useState<ModelsTreeSubTreeError | undefined>(undefined);
  const hierarchyConfiguration = useMemo<ModelsTreeHierarchyConfiguration>(
    () => ({
      ...defaultHierarchyConfiguration,
      ...hierarchyConfig,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    Object.values(hierarchyConfig ?? {}),
  );
  const componentId = useGuid();
  const { onFeatureUsed } = useTelemetryContext();

  const { getCache: getModelsTreeIdsCache } = useIdsCache<ModelsTreeIdsCache, { hierarchyConfig: ModelsTreeHierarchyConfiguration }>({
    imodel: activeView.iModel,
    createCache,
    cacheSpecificProps: useMemo(() => ({ hierarchyConfig: hierarchyConfiguration }), [hierarchyConfiguration]),
    componentId,
  });

  const { visibilityHandlerFactory, onFilteredPathsChanged } = useCachedVisibility({
    activeView,
    overrides: visibilityHandlerOverrides,
    getModelsTreeIdsCache,
    componentId,
  });
  const { loadFocusedItems } = useFocusedInstancesContext();

  const getHierarchyDefinition = useCallback<VisibilityTreeProps["getHierarchyDefinition"]>(
    ({ imodelAccess }) => new ModelsTreeDefinition({ imodelAccess, idsCache: getModelsTreeIdsCache(), hierarchyConfig: hierarchyConfiguration, componentId }),
    [getModelsTreeIdsCache, hierarchyConfiguration, componentId],
  );

  const onNodeDoubleClick = useCallback(
    async ({ nodeData, extendedData }: PresentationHierarchyNode) => {
      if (!HierarchyNode.isInstancesNode(nodeData) || (extendedData && (extendedData.isSubject || extendedData.isModel || extendedData.isCategory))) {
        return;
      }
      const instanceIds = nodeData.key.instanceKeys.map((instanceKey) => instanceKey.id);
      await IModelApp.viewManager.selectedView?.zoomToElements(instanceIds);
      onFeatureUsed({ featureId: "zoom-to-node", reportInteraction: false });
    },
    [onFeatureUsed],
  );

  const getSubTreePathsInternal = useMemo<
    ((...props: Parameters<Required<VisibilityTreeProps>["getFilteredPaths"]>) => Promise<HierarchyNodeIdentifiersPath[]>) | undefined
  >(() => {
    if (!getSubTreePaths) {
      return undefined;
    }
    return async ({ imodelAccess, abortSignal }) => {
      try {
        const paths = await getSubTreePaths({
          createInstanceKeyPaths: async ({ targetItems }) =>
            ModelsTreeDefinition.createInstanceKeyPaths({
              imodelAccess,
              targetItems,
              idsCache: getModelsTreeIdsCache(),
              hierarchyConfig: hierarchyConfiguration,
              limit: "unbounded",
              abortSignal,
              componentId: `${componentId}/subTree`,
            }),
        });
        return paths.map(HierarchyFilteringPath.normalize).map(({ path }) => path);
      } catch (e) {
        const newError = "unknownSubTreeError";
        setSubTreeError(newError);
        return [];
      }
    };
  }, [getModelsTreeIdsCache, hierarchyConfiguration, getSubTreePaths, componentId]);

  const getPaths = useMemo<VisibilityTreeProps["getFilteredPaths"] | undefined>(() => {
    setFilteringError(undefined);
    onModelsFiltered?.(undefined);

    // reset filtered paths if there is no filters applied. This allows to keep current filtered paths until new paths are loaded.
    if (!loadFocusedItems && !getFilteredPaths && !filter && !getSubTreePathsInternal) {
      onFilteredPathsChanged(undefined);
    }

    const handlePaths = async (filteredPaths: HierarchyFilteringPath[] | undefined, classInspector: ECClassHierarchyInspector) => {
      onFilteredPathsChanged(filteredPaths);
      if (!onModelsFiltered) {
        return;
      }

      const modelIds = filteredPaths ? await getModels(filteredPaths, getModelsTreeIdsCache(), classInspector) : undefined;
      onModelsFiltered(modelIds);
    };

    if (loadFocusedItems) {
      return async ({ imodelAccess, abortSignal }) => {
        try {
          const focusedItems = await collectFocusedItems(loadFocusedItems);
          return await createFilteringPathsResult({
            getFilteringPaths: async () => {
              const paths = await ModelsTreeDefinition.createInstanceKeyPaths({
                imodelAccess,
                idsCache: getModelsTreeIdsCache(),
                targetItems: focusedItems,
                hierarchyConfig: hierarchyConfiguration,
                abortSignal,
                componentId,
              });
              return paths.map(({ path, options }) => ({ path, options: { ...options, autoExpand: true } }));
            },
            getSubTreePaths: async () => (getSubTreePathsInternal ? getSubTreePathsInternal({ imodelAccess, abortSignal }) : undefined),
            handlePaths: async (paths) => handlePaths(paths, imodelAccess),
          });
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
      return async ({ imodelAccess, abortSignal }) => {
        try {
          return await createFilteringPathsResult({
            getFilteringPaths: async () => {
              const paths = await getFilteredPaths({
                createInstanceKeyPaths: async (props) =>
                  ModelsTreeDefinition.createInstanceKeyPaths({
                    ...props,
                    imodelAccess,
                    idsCache: getModelsTreeIdsCache(),
                    hierarchyConfig: hierarchyConfiguration,
                    limit: "unbounded",
                    abortSignal,
                    componentId,
                  }),
                filter,
              });
              return paths?.map(HierarchyFilteringPath.normalize);
            },
            getSubTreePaths: async () => (getSubTreePathsInternal ? getSubTreePathsInternal({ imodelAccess, abortSignal }) : undefined),
            handlePaths: async (paths) => handlePaths(paths, imodelAccess),
          });
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
      return async ({ imodelAccess, abortSignal }) => {
        onFeatureUsed({ featureId: "filtering", reportInteraction: true });
        try {
          return await createFilteringPathsResult({
            getFilteringPaths: async () => {
              const paths = await ModelsTreeDefinition.createInstanceKeyPaths({
                imodelAccess,
                label: filter,
                idsCache: getModelsTreeIdsCache(),
                hierarchyConfig: hierarchyConfiguration,
                abortSignal,
                componentId,
              });
              return paths.map(({ path, options }) => ({ path, options: { ...options, autoExpand: true } }));
            },
            getSubTreePaths: async () => (getSubTreePathsInternal ? getSubTreePathsInternal({ imodelAccess, abortSignal }) : undefined),
            handlePaths: async (paths) => handlePaths(paths, imodelAccess),
          });
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
    return getSubTreePathsInternal;
  }, [
    filter,
    loadFocusedItems,
    getModelsTreeIdsCache,
    onFeatureUsed,
    getFilteredPaths,
    hierarchyConfiguration,
    onModelsFiltered,
    onFilteredPathsChanged,
    getSubTreePathsInternal,
    componentId,
  ]);

  const nodeSelectionPredicate = useCallback<NonNullable<VisibilityTreeProps["selectionPredicate"]>>(
    (node) => {
      if (!nodeTypeSelectionPredicate) {
        return true;
      }
      return nodeTypeSelectionPredicate({ node, type: ModelsTreeNode.getType(node.nodeData) });
    },
    [nodeTypeSelectionPredicate],
  );

  return {
    modelsTreeProps: {
      treeName: "models-tree-v2",
      visibilityHandlerFactory,
      getHierarchyDefinition,
      getFilteredPaths: getPaths,
      noDataMessage: getNoDataMessage(filter, subTreeError, filteringError),
      highlight: filter ? { text: filter } : undefined,
      selectionPredicate: nodeSelectionPredicate,
    },
    rendererProps: {
      onNodeDoubleClick,
      getIcon,
    },
  };
}

async function getModels(paths: HierarchyFilteringPath[], idsCache: ModelsTreeIdsCache, classInspector: ECClassHierarchyInspector) {
  if (!paths) {
    return undefined;
  }

  const targetModels = new Set<Id64String>();
  const targetSubjects = new Set<Id64String>();
  for (const path of paths) {
    const currPath = Array.isArray(path) ? path : path.path;
    for (let i = 0; i < currPath.length; i++) {
      const currStep = currPath[i];
      if (!HierarchyNodeIdentifier.isInstanceNodeIdentifier(currStep)) {
        break;
      }

      // if paths end with subject need to get all models under that subject
      if (i === currPath.length - 1 && currStep.className === "BisCore.Subject") {
        targetSubjects.add(currStep.id);
        break;
      }

      // collect all the models from the filtered path
      if (await classInspector.classDerivesFrom(currStep.className, "BisCore.GeometricModel3d")) {
        targetModels.add(currStep.id);
      }
    }
  }

  const matchingModels = await idsCache.getSubjectModelIds([...targetSubjects]);
  return [...targetModels, ...matchingModels];
}

function getNoDataMessage(filter?: string, subTreeError?: ModelsTreeSubTreeError, filteringError?: ModelsTreeFilteringError) {
  if (isSubTreeError(subTreeError)) {
    return <Text>{TreeWidget.translate(`modelsTree.subTree.${subTreeError}`)}</Text>;
  }
  if (isInstanceFocusError(filteringError)) {
    return <InstanceFocusError error={filteringError} />;
  }
  if (isFilterError(filteringError)) {
    return <Text>{TreeWidget.translate(`modelsTree.filtering.${filteringError}`)}</Text>;
  }
  if (filter) {
    return <Text>{TreeWidget.translate("modelsTree.filtering.noMatches", { filter })}</Text>;
  }
  return undefined;
}

function isSubTreeError(error: ModelsTreeSubTreeError | undefined) {
  return error === "unknownSubTreeError";
}

function isFilterError(error: ModelsTreeFilteringError | undefined) {
  return error === "tooManyFilterMatches" || error === "unknownFilterError";
}

function isInstanceFocusError(error: ModelsTreeFilteringError | undefined) {
  return error === "tooManyInstancesFocused" || error === "unknownInstanceFocusError";
}

function InstanceFocusError({ error }: { error: ModelsTreeFilteringError }) {
  const { toggle } = useFocusedInstancesContext();
  const localizedMessage = createLocalizedMessage(TreeWidget.translate(`modelsTree.filtering.${error}`), () => toggle());
  return <Text>{localizedMessage}</Text>;
}

function getIcon(node: PresentationHierarchyNode): ReactElement | undefined {
  if (node.extendedData?.imageId === undefined) {
    return undefined;
  }

  switch (node.extendedData.imageId) {
    case "icon-layers":
      return <SvgLayers />;
    case "icon-item":
      return <SvgItem />;
    case "icon-ec-class":
      return <SvgClassGrouping />;
    case "icon-imodel-hollow-2":
      return <SvgImodelHollow />;
    case "icon-folder":
      return <SvgFolder />;
    case "icon-model":
      return <SvgModel />;
  }

  return undefined;
}

function createVisibilityHandlerFactory(props: {
  activeView: Viewport;
  idsCacheGetter: () => ModelsTreeIdsCache;
  overrides?: ModelsTreeVisibilityHandlerOverrides;
  filteredPaths?: HierarchyFilteringPath[];
  componentId: GuidString;
}): VisibilityTreeProps["visibilityHandlerFactory"] {
  const { activeView, componentId, idsCacheGetter, filteredPaths, overrides } = props;
  return ({ imodelAccess }) =>
    createModelsTreeVisibilityHandler({ viewport: activeView, idsCache: idsCacheGetter(), imodelAccess, overrides, filteredPaths, componentId });
}

function useCachedVisibility(props: {
  activeView: Viewport;
  getModelsTreeIdsCache: () => ModelsTreeIdsCache;
  overrides?: ModelsTreeVisibilityHandlerOverrides;
  componentId: GuidString;
}) {
  const { activeView, getModelsTreeIdsCache, overrides, componentId } = props;
  const currentIModelRef = useRef(activeView.iModel);

  const [filteredPaths, setFilteredPaths] = useState<HierarchyFilteringPath[]>();
  const [visibilityHandlerFactory, setVisibilityHandlerFactory] = useState<VisibilityTreeProps["visibilityHandlerFactory"]>(() =>
    createVisibilityHandlerFactory({ activeView, idsCacheGetter: getModelsTreeIdsCache, overrides, filteredPaths, componentId }),
  );

  useEffect(() => {
    currentIModelRef.current = activeView.iModel;
    setVisibilityHandlerFactory(() =>
      createVisibilityHandlerFactory({ activeView, idsCacheGetter: getModelsTreeIdsCache, overrides, filteredPaths, componentId }),
    );
  }, [activeView, getModelsTreeIdsCache, overrides, filteredPaths, componentId]);

  return {
    visibilityHandlerFactory,
    onFilteredPathsChanged: useCallback((paths: HierarchyFilteringPath[] | undefined) => setFilteredPaths(paths), []),
  };
}

function SvgClassGrouping() {
  return (
    <svg id="Calque_1" data-name="Calque 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
      <path d="M8.00933,0,0,3.97672V11.986L8.00933,16,16,11.93V3.97651ZM1.66173,11.27642c-.26155.03734-.59754-.26154-.76553-.69085-.168-.41066-.09334-.784.168-.82152.26154-.03734.59754.26154.76553.67219C1.99772,10.86577,1.92306,11.23909,1.66173,11.27642Zm0-3.32319c-.26155.03733-.59754-.28-.76553-.69086-.168-.42932-.09334-.80285.168-.84.26133-.03733.59754.28.76532.69086C1.99772,7.54236,1.92306,7.89723,1.66173,7.95323Zm4.31276,5.52621a.18186.18186,0,0,1-.16821-.01866L3.41657,12.15394a.94275.94275,0,0,1-.29887-.80285c.03754-.33621.22421-.52265.41108-.41066L5.9185,12.24727a.88656.88656,0,0,1,.28.80285A.5057.5057,0,0,1,5.97449,13.47944Zm0-3.37919a.18184.18184,0,0,1-.16821-.01867L3.41657,8.77475a.943.943,0,0,1-.29887-.80286c.03754-.3362.22421-.52286.41108-.42953L5.9185,8.86786a.83112.83112,0,0,1,.28.78419A.51684.51684,0,0,1,5.97449,10.10025Z" />
    </svg>
  );
}

async function collectFocusedItems(loadFocusedItems: () => AsyncIterableIterator<InstanceKey | GroupingHierarchyNode>) {
  const focusedItems: Array<InstanceKey | ElementsGroupInfo> = [];
  const groupingNodeInfos: Array<{
    parentKey: InstancesNodeKey;
    parentType: "element" | "category";
    groupingNode: ClassGroupingHierarchyNode;
    modelIds: Id64String[];
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

function createLocalizedMessage(message: string, onClick?: () => void) {
  const exp = new RegExp("<link>(.*)</link>");
  const match = message.match(exp);
  if (!match) {
    return message;
  }

  const [fullText, innerText] = match;
  const [textBefore, textAfter] = message.split(fullText);

  return (
    <>
      {textBefore ? textBefore : null}
      <Anchor
        underline
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
      >
        {innerText}
      </Anchor>
      {textAfter ? textAfter : null}
    </>
  );
}

async function createFilteringPathsResult({
  getSubTreePaths,
  getFilteringPaths,
  handlePaths,
}: {
  getSubTreePaths: () => Promise<HierarchyNodeIdentifiersPath[] | undefined>;
  getFilteringPaths: () => Promise<NormalizedHierarchyFilteringPath[] | undefined>;
  handlePaths: (filteredPaths: HierarchyFilteringPath[] | undefined) => Promise<void>;
}): Promise<HierarchyFilteringPath[] | undefined> {
  const [subTreePaths, filterPaths] = await Promise.all([getSubTreePaths(), getFilteringPaths()]);
  let joinedPaths: HierarchyFilteringPath[] | undefined;
  try {
    if (subTreePaths && filterPaths) {
      return (joinedPaths = joinHierarchyFilteringPaths(subTreePaths, filterPaths));
    }
    if (subTreePaths) {
      return (joinedPaths = subTreePaths);
    }
    if (filterPaths) {
      return (joinedPaths = filterPaths);
    }
  } finally {
    void handlePaths(joinedPaths);
  }
  return joinedPaths;
}

function createCache(props: CreateCacheProps<{ hierarchyConfig: ModelsTreeHierarchyConfiguration }>) {
  return new ModelsTreeIdsCache(createECSqlQueryExecutor(props.imodel), props.specificProps.hierarchyConfig);
}
