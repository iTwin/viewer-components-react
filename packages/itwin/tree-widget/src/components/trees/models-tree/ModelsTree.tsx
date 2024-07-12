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
import { VisibilityTree } from "../common/components/VisibilityTree";
import { VisibilityTreeRenderer } from "../common/components/VisibilityTreeRenderer";
import { useFocusedInstancesContext } from "../common/FocusedInstancesContext";
import { FilterLimitExceededError } from "../common/TreeErrors";
import { useIModelChangeListener } from "../common/UseIModelChangeListener";
import { useTelemetryContext } from "../common/UseTelemetryContext";
import { ModelsTreeIdsCache } from "./internal/ModelsTreeIdsCache";
import { createModelsTreeVisibilityHandler } from "./internal/ModelsTreeVisibilityHandler";
import { ModelsTreeComponent } from "./ModelsTreeComponent";
import { createInstanceKeyPaths, defaultHierarchyConfiguration, ModelsTreeDefinition } from "./ModelsTreeDefinition";

import type { ModelsTreeVisibilityHandlerOverrides } from "./internal/ModelsTreeVisibilityHandler";
import type { Id64String } from "@itwin/core-bentley";
import type { GroupingHierarchyNode, InstancesNodeKey } from "@itwin/presentation-hierarchies";
import type { ElementsGroupInfo, ModelsTreeHierarchyConfiguration } from "./ModelsTreeDefinition";
import type { InstanceKey } from "@itwin/presentation-shared";
import type { ComponentPropsWithoutRef, ReactElement } from "react";
import type { Viewport } from "@itwin/core-frontend";
import type { PresentationHierarchyNode, useTree } from "@itwin/presentation-hierarchies-react";

type ModelsTreeFilteringError = "tooManyFilterMatches" | "tooManyInstancesFocused" | "unknownFilterError" | "unknownInstanceFocusError";
type UseTreeProps = Parameters<typeof useTree>[0];
type IModelAccess = UseTreeProps["imodelAccess"];
type FilteredPaths = ReturnType<Required<VisibilityTreeProps>["getFilteredPaths"]>;

/** @beta */
interface ModelsTreeOwnProps {
  activeView: Viewport;
  hierarchyLevelConfig?: {
    sizeLimit?: number;
  };
  hierarchyConfig?: Partial<ModelsTreeHierarchyConfiguration>;
  visibilityHandlerOverrides?: ModelsTreeVisibilityHandlerOverrides;
  filter?: string;
  getFilteredPaths?: (props: { imodelAccess: IModelAccess; idsCache: ModelsTreeIdsCache; hierarchyConfig: ModelsTreeHierarchyConfiguration }) => FilteredPaths;
}

/** @beta */
type VisibilityTreeProps = ComponentPropsWithoutRef<typeof VisibilityTree>;

/** @beta */
type ModelsTreeProps = ModelsTreeOwnProps &
  Pick<VisibilityTreeProps, "imodel" | "getSchemaContext" | "selectionStorage" | "height" | "width" | "density" | "selectionMode">;

/** @beta */
export function ModelsTree({
  imodel,
  getSchemaContext,
  selectionStorage,
  height,
  width,
  activeView,
  filter,
  density,
  hierarchyLevelConfig,
  hierarchyConfig,
  selectionMode,
  visibilityHandlerOverrides,
  getFilteredPaths,
}: ModelsTreeProps) {
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

  const getFocusedFilteredPaths = useMemo<VisibilityTreeProps["getFilteredPaths"] | undefined>(() => {
    setFilteringError(undefined);
    if (!loadFocusedInstancesKeys) {
      return undefined;
    }
    return async ({ imodelAccess }) => {
      try {
        const targetKeys = await collectTargetKeys(loadFocusedInstancesKeys);
        return await createInstanceKeyPaths({
          imodelAccess,
          idsCache: getModelsTreeIdsCache(),
          keys: targetKeys,
          hierarchyConfig: hierarchyConfiguration,
        });
      } catch (e) {
        const newError = FilterLimitExceededError ? "tooManyInstancesFocused" : "unknownInstanceFocusError";
        if (newError !== "tooManyInstancesFocused") {
          const feature = e instanceof Error && e.message.includes("query too long to execute or server is too busy") ? "error-timeout" : "error-unknown";
          onFeatureUsed({ featureId: feature, reportInteraction: false });
        }
        setFilteringError(newError);
        return [];
      }
    };
  }, [loadFocusedInstancesKeys, getModelsTreeIdsCache, onFeatureUsed, hierarchyConfiguration]);

  const getSearchFilteredPaths = useMemo<VisibilityTreeProps["getFilteredPaths"] | undefined>(() => {
    setFilteringError(undefined);
    if (!filter) {
      return undefined;
    }
    return async ({ imodelAccess }) => {
      onFeatureUsed({ featureId: "filtering", reportInteraction: true });
      try {
        return await createInstanceKeyPaths({
          imodelAccess,
          label: filter,
          idsCache: getModelsTreeIdsCache(),
          hierarchyConfig: hierarchyConfiguration,
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
  }, [filter, getModelsTreeIdsCache, onFeatureUsed, hierarchyConfiguration]);

  const getFilterPaths = useMemo<VisibilityTreeProps["getFilteredPaths"]>(() => {
    setFilteringError(undefined);
    if (!getFilteredPaths) {
      return undefined;
    }
    return async ({ imodelAccess }) => {
      try {
        return await getFilteredPaths({ imodelAccess, idsCache: getModelsTreeIdsCache(), hierarchyConfig: hierarchyConfiguration });
      } catch (e) {
        const newError = e instanceof FilterLimitExceededError ? "tooManyFilterMatches" : "unknownFilterError";
        setFilteringError(newError);
        return [];
      }
    };
  }, [hierarchyConfiguration, getModelsTreeIdsCache, getFilteredPaths]);

  return (
    <VisibilityTree
      height={height}
      width={width}
      imodel={imodel}
      treeName={ModelsTreeComponent.id}
      selectionStorage={selectionStorage}
      getSchemaContext={getSchemaContext}
      visibilityHandlerFactory={visibilityHandlerFactory}
      getHierarchyDefinition={getHierarchyDefinition}
      getFilteredPaths={getFocusedFilteredPaths ?? getFilterPaths ?? getSearchFilteredPaths}
      hierarchyLevelSizeLimit={hierarchyLevelConfig?.sizeLimit}
      density={density}
      noDataMessage={getNoDataMessage(filter, filteringError)}
      selectionMode={selectionMode}
      highlight={filter === undefined ? undefined : { text: filter }}
      treeRenderer={(treeProps) => <VisibilityTreeRenderer {...treeProps} getIcon={getIcon} onNodeDoubleClick={onNodeDoubleClick} />}
    />
  );
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
