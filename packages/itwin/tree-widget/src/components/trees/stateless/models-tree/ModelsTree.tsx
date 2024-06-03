/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useMemo, useRef, useState } from "react";
import { SvgFolder, SvgImodelHollow, SvgItem, SvgLayers, SvgModel } from "@itwin/itwinui-icons-react";
import { Text } from "@itwin/itwinui-react";
import { TreeWidget } from "../../../../TreeWidget";
import { useFeatureReporting } from "../../common/UseFeatureReporting";
import { VisibilityTree } from "../common/components/VisibilityTree";
import { useFocusedInstancesContext } from "../common/FocusedInstancesContext";
import { useIModelChangeListener } from "../common/UseIModelChangeListener";
import { ModelsTreeIdsCache } from "./internal/ModelsTreeIdsCache";
import { createModelsTreeVisibilityHandler } from "./internal/ModelsTreeVisibilityHandler";
import { ModelsTreeDefinition } from "./ModelsTreeDefinition";

import type { ComponentPropsWithoutRef, ReactElement } from "react";
import type { Viewport } from "@itwin/core-frontend";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { HierarchyLevelConfig } from "../../common/Types";

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

type StatelessModelsTreeProps = StatelessModelsTreeOwnProps &
  Pick<VisibilityTreeProps, "imodel" | "getSchemaContext" | "height" | "width" | "density" | "selectionMode">;

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
  selectionMode,
  onPerformanceMeasured,
  onFeatureUsed,
}: StatelessModelsTreeProps) {
  const { getModelsTreeIdsCache, visibilityHandler } = useCachedVisibility(activeView);

  const { instanceKeys: focusedInstancesKeys } = useFocusedInstancesContext();
  const { reportUsage } = useFeatureReporting({ onFeatureUsed, treeIdentifier: StatelessModelsTreeId });

  const getHierarchyDefinition = useCallback<GetHierarchyDefinitionCallback>(
    ({ imodelAccess }) => new ModelsTreeDefinition({ imodelAccess, idsCache: getModelsTreeIdsCache(imodelAccess) }),
    [getModelsTreeIdsCache],
  );

  const getFocusedFilteredPaths = useMemo<GetFilteredPathsCallback | undefined>(() => {
    if (!focusedInstancesKeys) {
      return undefined;
    }
    return async ({ imodelAccess }) =>
      ModelsTreeDefinition.createInstanceKeyPaths({ imodelAccess, keys: focusedInstancesKeys, idsCache: getModelsTreeIdsCache(imodelAccess) });
  }, [focusedInstancesKeys, getModelsTreeIdsCache]);

  const getSearchFilteredPaths = useMemo<GetFilteredPathsCallback | undefined>(() => {
    if (!filter) {
      return undefined;
    }
    return async ({ imodelAccess }) => {
      reportUsage?.({ featureId: "filtering", reportInteraction: true });
      return ModelsTreeDefinition.createInstanceKeyPaths({ imodelAccess, label: filter, idsCache: getModelsTreeIdsCache(imodelAccess) });
    };
  }, [filter, getModelsTreeIdsCache, reportUsage]);

  const getFilteredPaths = getFocusedFilteredPaths ?? getSearchFilteredPaths;

  return (
    <VisibilityTree
      height={height}
      width={width}
      imodel={imodel}
      treeName="StatelessModelsTree"
      getSchemaContext={getSchemaContext}
      visibilityHandler={visibilityHandler}
      getHierarchyDefinition={getHierarchyDefinition}
      getFilteredPaths={getFilteredPaths}
      hierarchyLevelSizeLimit={hierarchyLevelConfig?.sizeLimit}
      getIcon={getIcon}
      density={density}
      noDataMessage={getNoDataMessage(filter)}
      selectionMode={selectionMode}
      onPerformanceMeasured={(action, duration) => {
        onPerformanceMeasured?.(`${StatelessModelsTreeId}-${action}`, duration);
      }}
      reportUsage={reportUsage}
    />
  );
}

function getNoDataMessage(filter?: string) {
  if (filter) {
    return <Text>{TreeWidget.translate("stateless.noNodesMatchFilter", { filter })}</Text>;
  }
  return undefined;
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

function useCachedVisibility(activeView: Viewport) {
  const cacheRef = useRef<ModelsTreeIdsCache>();
  const prevImodelAccessRef = useRef<LimitingECSqlQueryExecutor>();

  const [visibilityHandler, setVisibilityHandler] = useState(createModelsTreeVisibilityHandler({ viewport: activeView }));

  useIModelChangeListener({
    imodel: activeView.iModel,
    action: useCallback(() => {
      cacheRef.current = undefined;
      setVisibilityHandler(createModelsTreeVisibilityHandler({ viewport: activeView }));
    }, [activeView]),
  });

  const getModelsTreeIdsCache = useCallback((imodelAccess: LimitingECSqlQueryExecutor) => {
    if (prevImodelAccessRef.current !== imodelAccess) {
      cacheRef.current = undefined;
      prevImodelAccessRef.current = imodelAccess;
    }

    if (!cacheRef.current) {
      const cache = new ModelsTreeIdsCache(imodelAccess);
      cacheRef.current = cache;
      setVisibilityHandler((handler) => {
        return { ...handler, idsCache: cache };
      });
    }
    return cacheRef.current;
  }, []);

  return {
    getModelsTreeIdsCache,
    visibilityHandler,
  };
}
