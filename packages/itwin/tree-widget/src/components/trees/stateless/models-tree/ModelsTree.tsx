/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useMemo, useRef } from "react";
import { SvgFolder, SvgImodelHollow, SvgItem, SvgLayers, SvgModel } from "@itwin/itwinui-icons-react";
import { Text } from "@itwin/itwinui-react";
import { TreeWidget } from "../../../../TreeWidget";
import { VisibilityTree } from "../common/components/VisibilityTree";
import { useFocusedInstancesContext } from "../common/FocusedInstancesContext";
import { ModelsTreeDefinition } from "./ModelsTreeDefinition";
import { StatelessModelsVisibilityHandler } from "./ModelsVisibilityHandler";
import { SubjectModelIdsCache } from "./SubjectModelIdsCache";

import type { ComponentPropsWithoutRef, ReactElement } from "react";
import type { Viewport } from "@itwin/core-frontend";
import type { HierarchyNode, LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { HierarchyLevelConfig } from "../../common/Types";

interface StatelessModelsTreeOwnProps {
  activeView: Viewport;
  hierarchyLevelConfig?: Omit<HierarchyLevelConfig, "isFilteringEnabled">;
  filter?: string;
  onPerformanceMeasured?: (featureId: string, duration: number) => void;
}

type VisibilityTreeProps = ComponentPropsWithoutRef<typeof VisibilityTree>;
type GetFilteredPathsCallback = VisibilityTreeProps["getFilteredPaths"];
type GetHierarchyDefinitionCallback = VisibilityTreeProps["getHierarchyDefinition"];

type StatelessModelsTreeProps = StatelessModelsTreeOwnProps &
  Pick<VisibilityTreeProps, "imodel" | "getSchemaContext" | "height" | "width" | "density" | "selectionMode">;

const StatelessModelsTreeId = "models-tree-v2";

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
}: StatelessModelsTreeProps) {
  const { getSubjectModelIdsCache } = useSubjectModelIdsCache();

  const visibilityHandlerFactory = useCallback(() => {
    const visibilityHandler = new StatelessModelsVisibilityHandler({ viewport: activeView });
    return {
      getVisibilityStatus: async (node: HierarchyNode) => visibilityHandler.getVisibilityStatus(node),
      changeVisibility: async (node: HierarchyNode, on: boolean) => visibilityHandler.changeVisibility(node, on),
      onVisibilityChange: visibilityHandler.onVisibilityChange,
      dispose: () => visibilityHandler.dispose(),
    };
  }, [activeView]);
  const { instanceKeys: focusedInstancesKeys } = useFocusedInstancesContext();

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
    return async ({ imodelAccess }) =>
      ModelsTreeDefinition.createInstanceKeyPaths({ imodelAccess, label: filter, subjectModelIdsCache: getSubjectModelIdsCache(imodelAccess) });
  }, [filter, getSubjectModelIdsCache]);

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

function useSubjectModelIdsCache() {
  const cacheRef = useRef<SubjectModelIdsCache>();
  const prevImodelAccessRef = useRef<LimitingECSqlQueryExecutor>();

  const getSubjectModelIdsCache = useCallback((imodelAccess: LimitingECSqlQueryExecutor) => {
    if (prevImodelAccessRef.current !== imodelAccess) {
      cacheRef.current = undefined;
      prevImodelAccessRef.current = imodelAccess;
    }
    if (!cacheRef.current) {
      cacheRef.current = new SubjectModelIdsCache(imodelAccess);
    }
    return cacheRef.current;
  }, []);

  return {
    getSubjectModelIdsCache,
  };
}
