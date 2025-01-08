/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IModelApp } from "@itwin/core-frontend";
import { SvgFolder, SvgImodelHollow, SvgItem, SvgLayers, SvgModel } from "@itwin/itwinui-icons-react";
import { Anchor, Text } from "@itwin/itwinui-react";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { HierarchyNode, HierarchyNodeIdentifier, HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { TreeWidget } from "../../../TreeWidget";
import { useFocusedInstancesContext } from "../common/FocusedInstancesContext";
import { FilterLimitExceededError } from "../common/TreeErrors";
import { useIModelChangeListener } from "../common/UseIModelChangeListener";
import { useTelemetryContext } from "../common/UseTelemetryContext";
import { ModelsTreeIdsCache } from "./internal/ModelsTreeIdsCache";
import { ModelsTreeNode } from "./internal/ModelsTreeNode";
import { createModelsTreeVisibilityHandler } from "./internal/ModelsTreeVisibilityHandler";
import { defaultHierarchyConfiguration, ModelsTreeDefinition } from "./ModelsTreeDefinition";

import type { GroupingHierarchyNode, HierarchyFilteringPath, InstancesNodeKey } from "@itwin/presentation-hierarchies";
import type { Id64String } from "@itwin/core-bentley";
import type { ECClassHierarchyInspector, InstanceKey } from "@itwin/presentation-shared";
import type { ReactElement } from "react";
import type { Viewport } from "@itwin/core-frontend";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { ClassGroupingHierarchyNode, ElementsGroupInfo, ModelsTreeHierarchyConfiguration } from "./ModelsTreeDefinition";
import type { ModelsTreeVisibilityHandlerOverrides } from "./internal/ModelsTreeVisibilityHandler";
import type { VisibilityTreeProps } from "../common/components/VisibilityTree";
import type { VisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer";

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

  return {
    modelsTreeProps: {
      treeName: "models-tree-v2",
      visibilityHandlerFactory,
      getHierarchyDefinition,
      getFilteredPaths: getPaths,
      noDataMessage: getNoDataMessage(filter, filteringError),
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

function getNoDataMessage(filter?: string, error?: ModelsTreeFilteringError) {
  if (isInstanceFocusError(error)) {
    return <InstanceFocusError error={error!} />;
  }
  if (isFilterError(error)) {
    return <Text>{TreeWidget.translate(`modelsTree.filtering.${error}`)}</Text>;
  }
  if (filter) {
    return <Text>{TreeWidget.translate("modelsTree.filtering.noMatches", { filter })}</Text>;
  }
  return undefined;
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

function createVisibilityHandlerFactory(
  activeView: Viewport,
  idsCacheGetter: () => ModelsTreeIdsCache,
  overrides?: ModelsTreeVisibilityHandlerOverrides,
  filteredPaths?: HierarchyFilteringPath[],
): VisibilityTreeProps["visibilityHandlerFactory"] {
  return ({ imodelAccess }) => createModelsTreeVisibilityHandler({ viewport: activeView, idsCache: idsCacheGetter(), imodelAccess, overrides, filteredPaths });
}

function useCachedVisibility(activeView: Viewport, hierarchyConfig: ModelsTreeHierarchyConfiguration, overrides?: ModelsTreeVisibilityHandlerOverrides) {
  const cacheRef = useRef<ModelsTreeIdsCache>();
  const currentIModelRef = useRef(activeView.iModel);

  const resetModelsTreeIdsCache = () => {
    cacheRef.current?.[Symbol.dispose]();
    cacheRef.current = undefined;
  };
  const getModelsTreeIdsCache = useCallback(() => {
    if (!cacheRef.current) {
      cacheRef.current = new ModelsTreeIdsCache(createECSqlQueryExecutor(currentIModelRef.current), hierarchyConfig);
    }
    return cacheRef.current;
  }, [hierarchyConfig]);

  const [filteredPaths, setFilteredPaths] = useState<HierarchyFilteringPath[]>();
  const [visibilityHandlerFactory, setVisibilityHandlerFactory] = useState<VisibilityTreeProps["visibilityHandlerFactory"]>(() =>
    createVisibilityHandlerFactory(activeView, getModelsTreeIdsCache, overrides, filteredPaths),
  );

  useIModelChangeListener({
    imodel: activeView.iModel,
    action: useCallback(() => {
      resetModelsTreeIdsCache();
      setVisibilityHandlerFactory(() => createVisibilityHandlerFactory(activeView, getModelsTreeIdsCache, overrides, filteredPaths));
    }, [activeView, getModelsTreeIdsCache, overrides, filteredPaths]),
  });

  useEffect(() => {
    currentIModelRef.current = activeView.iModel;
    setVisibilityHandlerFactory(() => createVisibilityHandlerFactory(activeView, getModelsTreeIdsCache, overrides, filteredPaths));
    return () => resetModelsTreeIdsCache();
  }, [activeView, getModelsTreeIdsCache, overrides, filteredPaths]);

  return {
    getModelsTreeIdsCache,
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
