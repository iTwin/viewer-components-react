/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useState } from "react";
import { Flex, ProgressRadial, Text } from "@itwin/itwinui-react";
import { createECSchemaProvider, createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createLimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import { useSelectionHandler, useUnifiedSelectionTree } from "@itwin/presentation-hierarchies-react";
import { createCachingECClassHierarchyInspector } from "@itwin/presentation-shared";
import { TreeWidget } from "../../../../../TreeWidget";
import { useReportingAction } from "../../../common/UseFeatureReporting";
import { useHierarchiesLocalization } from "../UseHierarchiesLocalization";
import { useHierarchyLevelFiltering } from "../UseHierarchyFiltering";
import { useIModelChangeListener } from "../UseIModelChangeListener";
import { useNodeHighlighting } from "../UseNodeHighlighting";
import { Delayed } from "./Delayed";
import { ProgressOverlay } from "./ProgressOverlay";
import { TreeRenderer } from "./TreeRenderer";

import type { IModelConnection } from "@itwin/core-frontend";
import type { SchemaContext } from "@itwin/ecschema-metadata";
import type { useTree } from "@itwin/presentation-hierarchies-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { UsageTrackedFeatures } from "../../../common/UseFeatureReporting";

type TreeRendererProps = Pick<
  ComponentPropsWithoutRef<typeof TreeRenderer>,
  | "rootNodes"
  | "expandNode"
  | "onNodeClick"
  | "onNodeKeyDown"
  | "onFilterClick"
  | "isNodeSelected"
  | "getHierarchyLevelDetails"
  | "size"
  | "getIcon"
  | "getLabel"
  | "getSublabel"
  | "onNodeDoubleClick"
>;

interface BaseTreeOwnProps {
  imodel: IModelConnection;
  getSchemaContext: (imodel: IModelConnection) => SchemaContext;
  height: number;
  width: number;
  treeName: string;
  treeRenderer?: (treeProps: TreeRendererProps) => ReactNode;
  hierarchyLevelSizeLimit?: number;
  density?: "default" | "enlarged";
  noDataMessage?: ReactNode;
  reportUsage?: (props: { featureId?: UsageTrackedFeatures; reportInteraction: boolean }) => void;
}

type UseTreeProps = Parameters<typeof useTree>[0];
type UseSelectionHandlerProps = Parameters<typeof useSelectionHandler>[0];
type UseNodeHighlightingProps = Parameters<typeof useNodeHighlighting>[0];
type IModelAccess = UseTreeProps["imodelAccess"];

type BaseTreeProps = BaseTreeOwnProps &
  Pick<UseTreeProps, "getFilteredPaths" | "getHierarchyDefinition" | "onPerformanceMeasured"> &
  Pick<Partial<UseSelectionHandlerProps>, "selectionMode"> &
  Pick<UseNodeHighlightingProps, "searchText"> &
  Pick<TreeRendererProps, "getIcon" | "getSublabel" | "onNodeDoubleClick">;

/** @internal */
export function BaseTree({ imodel, getSchemaContext, hierarchyLevelSizeLimit, ...props }: BaseTreeProps) {
  const [imodelAccess, setIModelAccess] = useState<IModelAccess>();
  const defaultHierarchyLevelSizeLimit = hierarchyLevelSizeLimit ?? 1000;

  useEffect(() => {
    const schemas = getSchemaContext(imodel);
    const schemaProvider = createECSchemaProvider(schemas);
    setIModelAccess({
      ...schemaProvider,
      ...createCachingECClassHierarchyInspector({ schemaProvider }),
      ...createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(imodel), 1000),
    });
  }, [imodel, getSchemaContext]);

  if (!imodelAccess) {
    return null;
  }

  return <BaseTreeRenderer {...props} imodel={imodel} imodelAccess={imodelAccess} defaultHierarchyLevelSizeLimit={defaultHierarchyLevelSizeLimit} />;
}

/** @internal */
function BaseTreeRenderer({
  imodel,
  imodelAccess,
  height,
  width,
  treeName,
  noDataMessage,
  getFilteredPaths,
  defaultHierarchyLevelSizeLimit,
  getHierarchyDefinition,
  selectionMode,
  onPerformanceMeasured,
  reportUsage,
  treeRenderer,
  density,
  getIcon,
  getSublabel,
  onNodeDoubleClick,
  searchText,
}: Omit<BaseTreeProps, "getSchemaContext"> & { imodelAccess: IModelAccess; defaultHierarchyLevelSizeLimit: number }) {
  const localizedStrings = useHierarchiesLocalization();
  const {
    rootNodes,
    isLoading,
    reloadTree,
    selectNodes,
    setFormatter: _setFormatter,
    expandNode,
    ...treeProps
  } = useUnifiedSelectionTree({
    imodelAccess,
    getHierarchyDefinition,
    getFilteredPaths,
    imodelKey: imodel.key,
    sourceName: treeName,
    localizedStrings,
    onPerformanceMeasured,
    onHierarchyLimitExceeded: () => reportUsage?.({ featureId: "hierarchy-level-size-limit-hit", reportInteraction: false }),
  });

  useIModelChangeListener({ imodel, action: useCallback(() => reloadTree({ dataSourceChanged: true }), [reloadTree]) });
  const reportingSelectNodes = useReportingAction({ action: selectNodes, reportUsage });
  const { onNodeClick, onNodeKeyDown } = useSelectionHandler({ rootNodes, selectNodes: reportingSelectNodes, selectionMode: selectionMode ?? "single" });
  const { filteringDialog, onFilterClick } = useHierarchyLevelFiltering({
    imodel,
    defaultHierarchyLevelSizeLimit,
    reportUsage,
  });
  const reportingExpandNode = useReportingAction({ action: expandNode, reportUsage });
  const reportingOnFilterClicked = useReportingAction({ action: onFilterClick, reportUsage });
  const { getLabel } = useNodeHighlighting({ rootNodes, searchText });

  if (rootNodes === undefined) {
    return (
      <Flex alignItems="center" justifyContent="center" flexDirection="column" style={{ width, height }}>
        <Delayed show={true}>
          <ProgressRadial size="large" />
        </Delayed>
      </Flex>
    );
  }

  if (rootNodes.length === 0 && !isLoading) {
    return (
      <Flex alignItems="center" justifyContent="center" flexDirection="column" style={{ width, height }}>
        {noDataMessage ? noDataMessage : <Text>{TreeWidget.translate("stateless.dataIsNotAvailable")}</Text>}
      </Flex>
    );
  }

  const treeRendererProps: TreeRendererProps = {
    ...treeProps,
    rootNodes,
    onNodeClick,
    onNodeKeyDown,
    expandNode: reportingExpandNode,
    onFilterClick: reportingOnFilterClicked,
    getIcon,
    getLabel,
    getSublabel,
    onNodeDoubleClick,
    size: density === "enlarged" ? "default" : "small",
  };

  return (
    <div style={{ position: "relative", height, overflow: "hidden" }}>
      <div style={{ overflow: "auto", height: "100%" }}>
        {treeRenderer ? treeRenderer(treeRendererProps) : <TreeRenderer {...treeRendererProps} />}
        {filteringDialog}
      </div>
      <Delayed show={isLoading}>
        <ProgressOverlay />
      </Delayed>
    </div>
  );
}
