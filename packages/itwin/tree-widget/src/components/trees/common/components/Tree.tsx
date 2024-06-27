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

import type { TreeRenderer } from "./TreeRenderer";
import type { MarkRequired } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { SchemaContext } from "@itwin/ecschema-metadata";
import type { useTree } from "@itwin/presentation-hierarchies-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { ReportUsageCallback } from "../UseFeatureReporting";

/**
 * Tree features that are tracked for usage.
 * @beta
 */
export type TreeUsageTrackedFeatures = "hierarchy-level-filtering" | "hierarchy-level-size-limit-hit";

/**
 * Properties that are passed to `treeRenderer from `Tree` component `.
 * @beta
 */
export type TreeRendererProps = Required<
  Pick<
    ComponentPropsWithoutRef<typeof TreeRenderer>,
    "rootNodes" | "expandNode" | "onNodeClick" | "onNodeKeyDown" | "onFilterClick" | "isNodeSelected" | "getHierarchyLevelDetails" | "size" | "getLabel"
  >
>;

interface TreeOwnProps {
  height: number;
  width: number;
  /** iModel connection that should be used to pull data from. */
  imodel: IModelConnection;
  /** Callback for getting `SchemaContext` for specific iModel. */
  getSchemaContext: (imodel: IModelConnection) => SchemaContext;
  /** Unique tree component name that will be used as unified selection change event source when selecting node. */
  treeName: string;
  /** Tree renderer that should be used to render tree data. */
  treeRenderer: (treeProps: TreeRendererProps) => ReactNode;
  /** Custom iModel access that is stored outside tree component. If not provided it new iModel access will be created using `imodel` prop. */
  imodelAccess?: IModelAccess;
  /** Size limit that should be applied on each hierarchy level. Default to `1000`. */
  hierarchyLevelSizeLimit?: number;
  /** Modifies the density of tree nodes. `enlarged` tree nodes have bigger button hit boxes. */
  density?: "default" | "enlarged";
  /** Message that should be renderer if there are no tree nodes. */
  noDataMessage?: ReactNode;
  /** Callback used to report tracked features usage. */
  reportUsage?: ReportUsageCallback<TreeUsageTrackedFeatures>;
}

type UseTreeProps = Parameters<typeof useTree>[0];
type UseSelectionHandlerProps = Parameters<typeof useSelectionHandler>[0];
type UseNodeHighlightingProps = Parameters<typeof useNodeHighlighting>[0];
type IModelAccess = UseTreeProps["imodelAccess"];

type TreeProps = TreeOwnProps &
  Pick<UseTreeProps, "getFilteredPaths" | "getHierarchyDefinition" | "onPerformanceMeasured"> &
  Pick<Partial<UseSelectionHandlerProps>, "selectionMode"> &
  Pick<UseNodeHighlightingProps, "searchText">;

/**
 * Default tree component that manages tree state and renders using supplied `treeRenderer`.
 * @Beta
 */
export function Tree({ getSchemaContext, hierarchyLevelSizeLimit, imodelAccess: providedIModelAccess, ...props }: TreeProps) {
  const defaultHierarchyLevelSizeLimit = hierarchyLevelSizeLimit ?? 1000;

  const imodelAccess = useMemo(() => {
    return providedIModelAccess ?? createIModelAccess({ getSchemaContext, imodel: props.imodel });
  }, [providedIModelAccess, getSchemaContext, props.imodel]);

  return (
    <SchemaMetadataContextProvider imodel={props.imodel} schemaContextProvider={getSchemaContext}>
      <TreeImpl {...props} imodelAccess={imodelAccess} defaultHierarchyLevelSizeLimit={defaultHierarchyLevelSizeLimit} />
    </SchemaMetadataContextProvider>
  );
}

/** @internal */
function TreeImpl({
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
  searchText,
}: MarkRequired<Omit<TreeProps, "getSchemaContext">, "imodelAccess"> & { defaultHierarchyLevelSizeLimit: number }) {
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
        {noDataMessage ? noDataMessage : <Text>{TreeWidget.translate("baseTree.dataIsNotAvailable")}</Text>}
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
    getLabel,
    size: density === "enlarged" ? "default" : "small",
  };

  return (
    <div style={{ position: "relative", height, overflow: "hidden" }}>
      <div id="tw-tree-renderer-container" style={{ overflow: "auto", height: "100%" }}>
        {treeRenderer(treeRendererProps)}
        {filteringDialog}
      </div>
      <Delayed show={isLoading}>
        <ProgressOverlay />
      </Delayed>
    </div>
  );
}
