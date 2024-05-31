/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useMemo, useRef } from "react";
import { SvgFolder, SvgImodelHollow, SvgItem, SvgLayers, SvgModel } from "@itwin/itwinui-icons-react";
import { Text } from "@itwin/itwinui-react";
import { TreeWidget } from "../../../../TreeWidget";
import { useFeatureReporting } from "../../common/UseFeatureReporting";
import { VisibilityTree } from "../common/components/VisibilityTree";
import { useFocusedInstancesContext } from "../common/FocusedInstancesContext";
import { useIModelChangeListener } from "../common/UseIModelChangeListener";
import { ModelsTreeIdsCache } from "./internal/ModelsTreeIdsCache";
import { ModelsTreeDefinition } from "./ModelsTreeDefinition";
import { createModelsTreeVisibilityHandler } from "./ModelsTreeVisibilityHandler";

import type { ModelsTreeVisibilityHandler } from "./ModelsTreeVisibilityHandler";
import type { ComponentPropsWithoutRef, ReactElement } from "react";
import type { IModelConnection , Viewport } from "@itwin/core-frontend";
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
  const { getSubjectModelIdsCache } = useSubjectModelIdsCache(imodel);

  const visibilityHandlerFactory = useCallback((): ModelsTreeVisibilityHandler => {
    return createModelsTreeVisibilityHandler({ viewport: activeView });
    // return new StatelessModelsVisibilityHandler({ viewport: activeView }) as unknown as HierarchyVisibilityHandler;
  }, [activeView]);
  const { instanceKeys: focusedInstancesKeys } = useFocusedInstancesContext();
  const { reportUsage } = useFeatureReporting({ onFeatureUsed, treeIdentifier: StatelessModelsTreeId });

  const getHierarchyDefinition = useCallback<GetHierarchyDefinitionCallback>(
    ({ imodelAccess }) => new ModelsTreeDefinition({ imodelAccess, subjectModelIdsCache: getSubjectModelIdsCache(imodelAccess) }),
    [getSubjectModelIdsCache],
  );

  const getFocusedFilteredPaths = useMemo<GetFilteredPathsCallback | undefined>(() => {
    if (!focusedInstancesKeys) {
      return undefined;
    }
    return async ({ imodelAccess }) =>
      ModelsTreeDefinition.createInstanceKeyPaths({ imodelAccess, keys: focusedInstancesKeys, subjectModelIdsCache: getSubjectModelIdsCache(imodelAccess) });
  }, [focusedInstancesKeys, getSubjectModelIdsCache]);

  const getSearchFilteredPaths = useMemo<GetFilteredPathsCallback | undefined>(() => {
    if (!filter) {
      return undefined;
    }
    return async ({ imodelAccess }) => {
      reportUsage?.({ featureId: "filtering", reportInteraction: true });
      return ModelsTreeDefinition.createInstanceKeyPaths({ imodelAccess, label: filter, subjectModelIdsCache: getSubjectModelIdsCache(imodelAccess) });
    };
  }, [filter, getSubjectModelIdsCache, reportUsage]);

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

function useSubjectModelIdsCache(imodel: IModelConnection) {
  const cacheRef = useRef<ModelsTreeIdsCache>();
  const prevImodelAccessRef = useRef<LimitingECSqlQueryExecutor>();

  useIModelChangeListener({
    imodel,
    action: useCallback(() => {
      cacheRef.current = undefined;
    }, []),
  });

  const getSubjectModelIdsCache = useCallback((imodelAccess: LimitingECSqlQueryExecutor) => {
    if (prevImodelAccessRef.current !== imodelAccess) {
      cacheRef.current?.dispose();
      cacheRef.current = undefined;
      prevImodelAccessRef.current = imodelAccess;
    }
    if (!cacheRef.current) {
      cacheRef.current = new ModelsTreeIdsCache(imodelAccess);
    }
    return cacheRef.current;
  }, []);

  return {
    getSubjectModelIdsCache,
  };
}
