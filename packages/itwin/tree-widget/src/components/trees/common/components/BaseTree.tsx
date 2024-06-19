/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useMemo } from "react";
import { Flex, ProgressRadial, Text } from "@itwin/itwinui-react";
import { SchemaMetadataContextProvider } from "@itwin/presentation-components";
import { useSelectionHandler, useUnifiedSelectionTree } from "@itwin/presentation-hierarchies-react";
import { TreeWidget } from "../../../../TreeWidget";
import { useReportingAction } from "../UseFeatureReporting";
import { useHierarchiesLocalization } from "../UseHierarchiesLocalization";
import { useHierarchyLevelFiltering } from "../UseHierarchyFiltering";
import { useIModelChangeListener } from "../UseIModelChangeListener";
import { useNodeHighlighting } from "../UseNodeHighlighting";
import { createIModelAccess } from "../Utils";
import { Delayed } from "./Delayed";
import { ProgressOverlay } from "./ProgressOverlay";
import { TreeRenderer } from "./TreeRenderer";

import type { MarkRequired } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { SchemaContext } from "@itwin/ecschema-metadata";
import type { useTree } from "@itwin/presentation-hierarchies-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { UsageTrackedFeatures } from "../UseFeatureReporting";

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
  imodelAccess?: IModelAccess;
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
export function BaseTree({ getSchemaContext, hierarchyLevelSizeLimit, imodelAccess: providedIModelAccess, ...props }: BaseTreeProps) {
  const defaultHierarchyLevelSizeLimit = hierarchyLevelSizeLimit ?? 1000;

  const imodelAccess = useMemo(() => {
    return providedIModelAccess ?? createIModelAccess({ getSchemaContext, imodel: props.imodel });
  }, [providedIModelAccess, getSchemaContext, props.imodel]);

  return (
    <SchemaMetadataContextProvider imodel={props.imodel} schemaContextProvider={getSchemaContext}>
      <BaseTreeRenderer {...props} imodelAccess={imodelAccess} defaultHierarchyLevelSizeLimit={defaultHierarchyLevelSizeLimit} />
    </SchemaMetadataContextProvider>
  );
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
}: MarkRequired<Omit<BaseTreeProps, "getSchemaContext">, "imodelAccess"> & { defaultHierarchyLevelSizeLimit: number }) {
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
