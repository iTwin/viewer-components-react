/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IModelApp } from "@itwin/core-frontend";
import { SvgFolder, SvgImodelHollow, SvgItem, SvgLayers, SvgModel } from "@itwin/itwinui-icons-react";
import { Anchor, Icon, Text } from "@itwin/itwinui-react";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { HierarchyNode, HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { TreeWidget } from "../../../TreeWidget";
import { useFocusedInstancesContext } from "../common/FocusedInstancesContext";
import { FilterLimitExceededError } from "../common/TreeErrors";
import { useIModelChangeListener } from "../common/UseIModelChangeListener";
import { useTelemetryContext } from "../common/UseTelemetryContext";
import { ModelsTreeIdsCache } from "./internal/ModelsTreeIdsCache";
import { createModelsTreeVisibilityHandler } from "./internal/ModelsTreeVisibilityHandler";
import { defaultHierarchyConfiguration, ModelsTreeDefinition } from "./ModelsTreeDefinition";

import type { Id64String } from "@itwin/core-bentley";
import type { GroupingHierarchyNode, InstancesNodeKey } from "@itwin/presentation-hierarchies";
import type { InstanceKey } from "@itwin/presentation-shared";
import type { ComponentPropsWithoutRef, ReactElement } from "react";
import type { Viewport } from "@itwin/core-frontend";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { ElementsGroupInfo, ModelsTreeHierarchyConfiguration } from "./ModelsTreeDefinition";
import type { ModelsTreeVisibilityHandlerOverrides } from "./internal/ModelsTreeVisibilityHandler";
import type { VisibilityTree } from "../common/components/VisibilityTree";
import type { VisibilityTreeRenderer } from "../common/components/VisibilityTreeRenderer";

type ModelsTreeFilteringError = "tooManyFilterMatches" | "tooManyInstancesFocused" | "unknownFilterError" | "unknownInstanceFocusError";
type HierarchyFilteringPaths = Awaited<ReturnType<Required<VisibilityTreeProps>["getFilteredPaths"]>>;

/** @beta */
type VisibilityTreeRendererProps = ComponentPropsWithoutRef<typeof VisibilityTreeRenderer>;

/** @beta */
type VisibilityTreeProps = ComponentPropsWithoutRef<typeof VisibilityTree>;

/** @beta */
interface UseModelsTreeProps {
  filter?: string;
  activeView: Viewport;
  hierarchyConfig?: Partial<ModelsTreeHierarchyConfiguration>;
  visibilityHandlerOverrides?: ModelsTreeVisibilityHandlerOverrides;
  getFilteredPaths?: (props: {
    createInstanceKeyPaths: (props: { keys: Array<InstanceKey | ElementsGroupInfo> } | { label: string }) => Promise<HierarchyFilteringPaths>;
  }) => Promise<HierarchyFilteringPaths>;
}

/** @beta */
interface UseModelsTreeResult {
  modelsTreeProps: Pick<
    VisibilityTreeProps,
    "treeName" | "getHierarchyDefinition" | "getFilteredPaths" | "visibilityHandlerFactory" | "highlight" | "noDataMessage"
  >;
  rendererProps: Pick<Required<VisibilityTreeRendererProps>, "getIcon" | "onNodeDoubleClick">;
}

/**
 * Custom hook to create and manage state for the models tree.
 * @beta
 */
export function useModelsTree({ activeView, filter, hierarchyConfig, visibilityHandlerOverrides, getFilteredPaths }: UseModelsTreeProps): UseModelsTreeResult {
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

  const { getModelsTreeIdsCache, visibilityHandlerFactory } = useCachedVisibility(activeView, hierarchyConfiguration, visibilityHandlerOverrides);
  const { loadInstanceKeys: loadFocusedInstancesKeys } = useFocusedInstancesContext();

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
    if (loadFocusedInstancesKeys) {
      return async ({ imodelAccess }) => {
        try {
          const targetKeys = await collectTargetKeys(loadFocusedInstancesKeys);
          const paths = await ModelsTreeDefinition.createInstanceKeyPaths({
            imodelAccess,
            idsCache: getModelsTreeIdsCache(),
            keys: targetKeys,
            hierarchyConfig: hierarchyConfiguration,
          });
          return paths.map((path) => ({ path, options: { autoExpand: true } }));
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
          return await getFilteredPaths({
            createInstanceKeyPaths: async (props) =>
              ModelsTreeDefinition.createInstanceKeyPaths({
                ...props,
                imodelAccess,
                idsCache: getModelsTreeIdsCache(),
                hierarchyConfig: hierarchyConfiguration,
              }),
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
      return async ({ imodelAccess }) => {
        onFeatureUsed({ featureId: "filtering", reportInteraction: true });
        try {
          const paths = await ModelsTreeDefinition.createInstanceKeyPaths({
            imodelAccess,
            label: filter,
            idsCache: getModelsTreeIdsCache(),
            hierarchyConfig: hierarchyConfiguration,
          });
          return paths.map((path) => ({ path, options: { autoExpand: true } }));
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
  }, [filter, loadFocusedInstancesKeys, getModelsTreeIdsCache, onFeatureUsed, getFilteredPaths, hierarchyConfiguration]);

  return {
    modelsTreeProps: {
      treeName: "models-tree-v2",
      visibilityHandlerFactory,
      getHierarchyDefinition,
      getFilteredPaths: getPaths,
      noDataMessage: getNoDataMessage(filter, filteringError),
      highlight: filter ? { text: filter } : undefined,
    },
    rendererProps: {
      onNodeDoubleClick,
      getIcon,
    },
  };
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
): VisibilityTreeProps["visibilityHandlerFactory"] {
  return ({ imodelAccess }) => createModelsTreeVisibilityHandler({ viewport: activeView, idsCache: idsCacheGetter(), imodelAccess, overrides });
}

function useCachedVisibility(activeView: Viewport, hierarchyConfig: ModelsTreeHierarchyConfiguration, overrides?: ModelsTreeVisibilityHandlerOverrides) {
  const cacheRef = useRef<ModelsTreeIdsCache>();
  const currentIModelRef = useRef(activeView.iModel);

  const getModelsTreeIdsCache = useCallback(() => {
    if (!cacheRef.current) {
      cacheRef.current = new ModelsTreeIdsCache(createECSqlQueryExecutor(currentIModelRef.current), hierarchyConfig);
    }
    return cacheRef.current;
  }, [hierarchyConfig]);

  const [visibilityHandlerFactory, setVisibilityHandlerFactory] = useState(() => createVisibilityHandlerFactory(activeView, getModelsTreeIdsCache, overrides));

  useIModelChangeListener({
    imodel: activeView.iModel,
    action: useCallback(() => {
      cacheRef.current = undefined;
      setVisibilityHandlerFactory(() => createVisibilityHandlerFactory(activeView, getModelsTreeIdsCache, overrides));
    }, [activeView, getModelsTreeIdsCache, overrides]),
  });

  useEffect(() => {
    currentIModelRef.current = activeView.iModel;
    cacheRef.current = undefined;
    setVisibilityHandlerFactory(() => createVisibilityHandlerFactory(activeView, getModelsTreeIdsCache, overrides));
  }, [activeView, getModelsTreeIdsCache, overrides]);

  return {
    getModelsTreeIdsCache,
    visibilityHandlerFactory,
  };
}

function SvgClassGrouping() {
  return (
    <Icon>
      <svg id="Calque_1" data-name="Calque 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
        <path d="M8.00933,0,0,3.97672V11.986L8.00933,16,16,11.93V3.97651ZM1.66173,11.27642c-.26155.03734-.59754-.26154-.76553-.69085-.168-.41066-.09334-.784.168-.82152.26154-.03734.59754.26154.76553.67219C1.99772,10.86577,1.92306,11.23909,1.66173,11.27642Zm0-3.32319c-.26155.03733-.59754-.28-.76553-.69086-.168-.42932-.09334-.80285.168-.84.26133-.03733.59754.28.76532.69086C1.99772,7.54236,1.92306,7.89723,1.66173,7.95323Zm4.31276,5.52621a.18186.18186,0,0,1-.16821-.01866L3.41657,12.15394a.94275.94275,0,0,1-.29887-.80285c.03754-.33621.22421-.52265.41108-.41066L5.9185,12.24727a.88656.88656,0,0,1,.28.80285A.5057.5057,0,0,1,5.97449,13.47944Zm0-3.37919a.18184.18184,0,0,1-.16821-.01867L3.41657,8.77475a.943.943,0,0,1-.29887-.80286c.03754-.3362.22421-.52286.41108-.42953L5.9185,8.86786a.83112.83112,0,0,1,.28.78419A.51684.51684,0,0,1,5.97449,10.10025Z" />
      </svg>
    </Icon>
  );
}

async function collectTargetKeys(loadFocusedInstancesKeys: () => AsyncIterableIterator<InstanceKey | GroupingHierarchyNode>) {
  const targetKeys: Array<InstanceKey | ElementsGroupInfo> = [];
  const groupingNodeInfos: Array<{ parentKey: InstancesNodeKey; parentType: "element" | "category"; classes: string[]; modelIds: Id64String[] }> = [];
  for await (const key of loadFocusedInstancesKeys()) {
    if ("id" in key) {
      targetKeys.push(key);
      continue;
    }

    if (!HierarchyNodeKey.isClassGrouping(key.key)) {
      targetKeys.push(...key.groupedInstanceKeys);
      continue;
    }

    if (!key.nonGroupingAncestor || !HierarchyNodeKey.isInstances(key.nonGroupingAncestor.key)) {
      continue;
    }

    const parentKey = key.nonGroupingAncestor.key;
    const type = key.nonGroupingAncestor.extendedData?.isCategory ? "category" : "element";
    const modelIds = ((key.nonGroupingAncestor.extendedData?.modelIds as Id64String[][]) ?? []).flatMap((ids) => ids);
    const groupInfo = groupingNodeInfos.find((group) => HierarchyNodeKey.equals(group.parentKey, parentKey));
    if (groupInfo) {
      groupInfo.classes.push(key.key.className);
    } else {
      groupingNodeInfos.push({ classes: [key.key.className], parentType: type, parentKey, modelIds });
    }
  }
  targetKeys.push(
    ...groupingNodeInfos.map(({ parentKey, parentType, classes, modelIds }) => ({
      parent:
        parentType === "element"
          ? { type: "element" as const, ids: parentKey.instanceKeys.map((key) => key.id) }
          : { type: "category" as const, ids: parentKey.instanceKeys.map((key) => key.id), modelIds },
      classes,
    })),
  );
  return targetKeys;
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
