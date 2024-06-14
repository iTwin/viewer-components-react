/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IModelApp } from "@itwin/core-frontend";
import { SvgFolder, SvgImodelHollow, SvgItem, SvgLayers, SvgModel } from "@itwin/itwinui-icons-react";
import { Anchor, Text } from "@itwin/itwinui-react";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { HierarchyNode } from "@itwin/presentation-hierarchies";
import { TreeWidget } from "../../../../TreeWidget";
import { useFeatureReporting } from "../../common/UseFeatureReporting";
import { VisibilityTree } from "../common/components/VisibilityTree";
import { useFocusedInstancesContext } from "../common/FocusedInstancesContext";
import { useIModelChangeListener } from "../common/UseIModelChangeListener";
import { useLatest } from "../common/UseLatest";
import { ModelsTreeIdsCache } from "./internal/ModelsTreeIdsCache";
import { createModelsTreeVisibilityHandler } from "./internal/ModelsTreeVisibilityHandler";
import { defaultHierarchyConfiguration, ModelsTreeDefinition } from "./ModelsTreeDefinition";

import type { ComponentPropsWithoutRef, ReactElement } from "react";
import type { Viewport } from "@itwin/core-frontend";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { HierarchyLevelConfig } from "../../common/Types";

type StatelessModelsTreeError = "tooManyFilterMatches" | "tooManyInstancesFocused" | "unknownFilterError" | "unknownInstanceFocusError";

interface StatelessModelsTreeOwnProps {
  activeView: Viewport;
  hierarchyLevelConfig?: Omit<HierarchyLevelConfig, "isFilteringEnabled">;
  filter?: string;
  onPerformanceMeasured?: (featureId: string, duration: number) => void;
  onFeatureUsed?: (feature: string) => void;
}

type VisibilityTreeProps = ComponentPropsWithoutRef<typeof VisibilityTree>;
type GetFilteredPathsCallback = VisibilityTreeProps["getFilteredPaths"];
type GetHierarchyDefinitionCallback = VisibilityTreeProps["getHierarchyDefinition"];
type ModelsTreeHierarchyConfiguration = ConstructorParameters<typeof ModelsTreeDefinition>[0]["hierarchyConfig"];

type StatelessModelsTreeProps = StatelessModelsTreeOwnProps &
  Pick<VisibilityTreeProps, "imodel" | "getSchemaContext" | "height" | "width" | "density" | "selectionMode"> & {
    hierarchyConfig?: Partial<ModelsTreeHierarchyConfiguration>;
  };

/** @internal */
export const StatelessModelsTreeId = "models-tree-v2";

/** @internal */
export function StatelessModelsTree({
  imodel,
  getSchemaContext,
  height,
  width,
  activeView,
  filter,
  density,
  hierarchyLevelConfig,
  hierarchyConfig,
  selectionMode,
  onPerformanceMeasured,
  onFeatureUsed,
}: StatelessModelsTreeProps) {
  const [error, setError] = useState<StatelessModelsTreeError | undefined>(undefined);
  const errorRef = useLatest(error);
  const hierarchyConfiguration = useMemo<ModelsTreeHierarchyConfiguration>(
    () => ({
      ...defaultHierarchyConfiguration,
      ...hierarchyConfig,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    Object.values(hierarchyConfig ?? {}),
  );

  const { getModelsTreeIdsCache, visibilityHandlerFactory } = useCachedVisibility(activeView, hierarchyConfiguration);
  const { instanceKeys: focusedInstancesKeys } = useFocusedInstancesContext();
  const { reportUsage } = useFeatureReporting({ onFeatureUsed, treeIdentifier: StatelessModelsTreeId });

  const getHierarchyDefinition = useCallback<GetHierarchyDefinitionCallback>(
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
      reportUsage({ featureId: "zoom-to-node", reportInteraction: false });
    },
    [reportUsage],
  );

  const getFocusedFilteredPaths = useMemo<GetFilteredPathsCallback | undefined>(() => {
    isInstanceFocusError(errorRef.current) && setError(undefined);
    if (!focusedInstancesKeys) {
      return undefined;
    }
    return async ({ imodelAccess }) => {
      try {
        return await ModelsTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          keys: focusedInstancesKeys,
          idsCache: getModelsTreeIdsCache(),
          hierarchyConfig: hierarchyConfiguration,
        });
      } catch (e) {
        const newError = e instanceof Error && e.message.match(/Filter matches more than \d+ items/) ? "tooManyInstancesFocused" : "unknownInstanceFocusError";
        setError(newError);
        return [];
      }
    };
  }, [focusedInstancesKeys, getModelsTreeIdsCache, hierarchyConfiguration, errorRef]);

  const getSearchFilteredPaths = useMemo<GetFilteredPathsCallback | undefined>(() => {
    isFilterError(errorRef.current) && setError(undefined);
    if (!filter) {
      return undefined;
    }
    return async ({ imodelAccess }) => {
      reportUsage?.({ featureId: "filtering", reportInteraction: true });
      try {
        return await ModelsTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: filter,
          idsCache: getModelsTreeIdsCache(),
          hierarchyConfig: hierarchyConfiguration,
        });
      } catch (e) {
        const newError = e instanceof Error && e.message.match(/Filter matches more than \d+ items/) ? "tooManyFilterMatches" : "unknownFilterError";
        setError(newError);
        return [];
      }
    };
  }, [filter, getModelsTreeIdsCache, reportUsage, hierarchyConfiguration, errorRef]);

  const getFilteredPaths = getFocusedFilteredPaths ?? getSearchFilteredPaths;

  return (
    <VisibilityTree
      height={height}
      width={width}
      imodel={imodel}
      treeName="StatelessModelsTree"
      getSchemaContext={getSchemaContext}
      visibilityHandlerFactory={visibilityHandlerFactory}
      getHierarchyDefinition={getHierarchyDefinition}
      getFilteredPaths={getFilteredPaths}
      hierarchyLevelSizeLimit={hierarchyLevelConfig?.sizeLimit}
      getIcon={getIcon}
      density={density}
      noDataMessage={getNoDataMessage(filter, error)}
      selectionMode={selectionMode}
      onPerformanceMeasured={(action, duration) => {
        onPerformanceMeasured?.(`${StatelessModelsTreeId}-${action}`, duration);
      }}
      reportUsage={reportUsage}
      onNodeDoubleClick={onNodeDoubleClick}
      searchText={filter}
    />
  );
}

function getNoDataMessage(filter?: string, error?: StatelessModelsTreeError) {
  if (isInstanceFocusError(error)) {
    return <InstanceFocusError error={error!} />;
  }
  if (isFilterError(error)) {
    return <Text>{TreeWidget.translate(`stateless.${error}`)}</Text>;
  }
  if (filter) {
    return <Text>{TreeWidget.translate("stateless.noNodesMatchFilter", { filter })}</Text>;
  }
  return undefined;
}

function isFilterError(error: StatelessModelsTreeError | undefined) {
  return error === "tooManyFilterMatches" || error === "unknownFilterError";
}

function isInstanceFocusError(error: StatelessModelsTreeError | undefined) {
  return error === "tooManyInstancesFocused" || error === "unknownInstanceFocusError";
}

function InstanceFocusError({ error }: { error: StatelessModelsTreeError }) {
  const { toggle } = useFocusedInstancesContext();
  const localizedMessage = createLocalizedMessage(TreeWidget.translate(`stateless.${error}`), () => toggle());
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
      return <SvgItem />;
    case "icon-imodel-hollow-2":
      return <SvgImodelHollow />;
    case "icon-folder":
      return <SvgFolder />;
    case "icon-model":
      return <SvgModel />;
  }

  return undefined;
}

function createVisibilityHandlerFactory(activeView: Viewport, idsCacheGetter: () => ModelsTreeIdsCache) {
  return () => createModelsTreeVisibilityHandler({ viewport: activeView, idsCache: idsCacheGetter() });
}

function useCachedVisibility(activeView: Viewport, hierarchyConfig: ModelsTreeHierarchyConfiguration) {
  const cacheRef = useRef<ModelsTreeIdsCache>();
  const currentIModelRef = useRef(activeView.iModel);

  const getModelsTreeIdsCache = useCallback(() => {
    if (!cacheRef.current) {
      cacheRef.current = new ModelsTreeIdsCache(createECSqlQueryExecutor(currentIModelRef.current), hierarchyConfig);
    }
    return cacheRef.current;
  }, [hierarchyConfig]);

  const [visibilityHandlerFactory, setVisibilityHandlerFactory] = useState(() => createVisibilityHandlerFactory(activeView, getModelsTreeIdsCache));

  useIModelChangeListener({
    imodel: activeView.iModel,
    action: useCallback(() => {
      cacheRef.current = undefined;
      setVisibilityHandlerFactory(() => createVisibilityHandlerFactory(activeView, getModelsTreeIdsCache));
    }, [activeView, getModelsTreeIdsCache]),
  });

  useEffect(() => {
    currentIModelRef.current = activeView.iModel;
    cacheRef.current = undefined;
    setVisibilityHandlerFactory(() => createVisibilityHandlerFactory(activeView, getModelsTreeIdsCache));
  }, [activeView, getModelsTreeIdsCache]);

  return {
    getModelsTreeIdsCache,
    visibilityHandlerFactory,
  };
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
