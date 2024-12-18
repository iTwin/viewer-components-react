/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useMemo, useState } from "react";
import { BeEvent } from "@itwin/core-bentley";
import { Flex, ProgressRadial, Text } from "@itwin/itwinui-react";
import { SchemaMetadataContextProvider } from "@itwin/presentation-components";
import { UnifiedSelectionProvider, useIModelUnifiedSelectionTree, useSelectionHandler } from "@itwin/presentation-hierarchies-react";
import { TreeWidget } from "../../../../TreeWidget";
import { useHierarchiesLocalization } from "../UseHierarchiesLocalization";
import { useHierarchyLevelFiltering } from "../UseHierarchyFiltering";
import { useIModelChangeListener } from "../UseIModelChangeListener";
import { useNodeHighlighting } from "../UseNodeHighlighting";
import { useReportingAction, useTelemetryContext } from "../UseTelemetryContext";
import { createIModelAccess } from "../Utils";
import { Delayed } from "./Delayed";
import { ProgressOverlay } from "./ProgressOverlay";

import type { MarkRequired } from "@itwin/core-bentley";
import type { FunctionProps } from "../Utils";
import type { ReactNode } from "react";
import type { IModelConnection } from "@itwin/core-frontend";
import type { SchemaContext } from "@itwin/ecschema-metadata";
import type { PresentationHierarchyNode, SelectionStorage, useIModelTree } from "@itwin/presentation-hierarchies-react";
import type { HighlightInfo } from "../UseNodeHighlighting";
import type { TreeRendererProps } from "./TreeRenderer";

/** @beta */
export type TreeProps = Pick<FunctionProps<typeof useIModelTree>, "getFilteredPaths" | "getHierarchyDefinition"> &
  Partial<Pick<FunctionProps<typeof useSelectionHandler>, "selectionMode">> & {
    /** iModel connection that should be used to pull data from. */
    imodel: IModelConnection;
    /** Callback for getting `SchemaContext` for specific iModel. */
    getSchemaContext: (imodel: IModelConnection) => SchemaContext;
    /** Unique tree component name that will be used as unified selection change event source when selecting node. */
    treeName: string;
    /** Unified selection storage that should be used by tree to handle tree selection changes. */
    selectionStorage: SelectionStorage;
    /**
     * An optional predicate to allow or prohibit selection of a node.
     * When not supplied, all nodes are selectable.
     */
    selectionPredicate?: (node: PresentationHierarchyNode) => boolean;
    /** Tree renderer that should be used to render tree data. */
    treeRenderer: (
      treeProps: Required<
        Pick<
          TreeRendererProps,
          "rootNodes" | "expandNode" | "onNodeClick" | "onNodeKeyDown" | "onFilterClick" | "isNodeSelected" | "getHierarchyLevelDetails" | "size" | "getLabel"
        >
      >,
    ) => ReactNode;
    /** Custom iModel access that is stored outside tree component. If not provided it new iModel access will be created using `imodel` prop. */
    imodelAccess?: FunctionProps<typeof useIModelTree>["imodelAccess"];
    /** Size limit that should be applied on each hierarchy level. Default to `1000`. */
    hierarchyLevelSizeLimit?: number;
    /** Modifies the density of tree nodes. `enlarged` tree nodes have bigger button hit boxes. */
    density?: "default" | "enlarged";
    /** Message that should be renderer if there are no tree nodes. */
    noDataMessage?: ReactNode;
    /** Callback that this invoked when tree reloads. */
    onReload?: () => void;
    /** Options for highlighting node labels. */
    highlight?: HighlightInfo;
  };

/**
 * Default tree component that manages tree state and renders using supplied `treeRenderer`.
 * @Beta
 */
export function Tree({ getSchemaContext, hierarchyLevelSizeLimit, selectionStorage, imodelAccess: providedIModelAccess, ...props }: TreeProps) {
  const defaultHierarchyLevelSizeLimit = hierarchyLevelSizeLimit ?? 1000;

  const imodelAccess = useMemo(() => {
    return providedIModelAccess ?? createIModelAccess({ getSchemaContext, imodel: props.imodel });
  }, [providedIModelAccess, getSchemaContext, props.imodel]);

  return (
    <SchemaMetadataContextProvider imodel={props.imodel} schemaContextProvider={getSchemaContext}>
      <UnifiedSelectionProvider storage={selectionStorage}>
        <TreeImpl {...props} imodelAccess={imodelAccess} defaultHierarchyLevelSizeLimit={defaultHierarchyLevelSizeLimit} />
      </UnifiedSelectionProvider>
    </SchemaMetadataContextProvider>
  );
}

function TreeImpl({
  imodel,
  imodelAccess,
  treeName,
  noDataMessage,
  getFilteredPaths,
  defaultHierarchyLevelSizeLimit,
  getHierarchyDefinition,
  selectionPredicate,
  selectionMode,
  onReload,
  treeRenderer,
  density,
  highlight,
}: MarkRequired<Omit<TreeProps, "getSchemaContext" | "selectionStorage">, "imodelAccess"> & { defaultHierarchyLevelSizeLimit: number }) {
  const localizedStrings = useHierarchiesLocalization();
  const { onFeatureUsed, onPerformanceMeasured } = useTelemetryContext();
  const [imodelChanged] = useState(new BeEvent<() => void>());
  const {
    rootNodes,
    getNode,
    isLoading,
    selectNodes: selectNodesAction,
    setFormatter: _setFormatter,
    expandNode,
    ...treeProps
  } = useIModelUnifiedSelectionTree({
    imodelAccess,
    imodelChanged,
    getHierarchyDefinition,
    getFilteredPaths,
    sourceName: treeName,
    localizedStrings,
    onPerformanceMeasured: (action, duration) => {
      if (action === "reload") {
        onReload?.();
      }
      onPerformanceMeasured(action, duration);
    },
    onHierarchyLimitExceeded: () => onFeatureUsed({ featureId: "hierarchy-level-size-limit-hit", reportInteraction: false }),
    onHierarchyLoadError: ({ type }) => onFeatureUsed({ featureId: `error-${type}`, reportInteraction: false }),
  });
  useIModelChangeListener({ imodel, action: useCallback(() => imodelChanged.raiseEvent(), [imodelChanged]) });

  const selectNodes = useSelectionPredicate({
    action: useReportingAction({ action: selectNodesAction }),
    predicate: selectionPredicate,
    getNode,
  });
  const { onNodeClick, onNodeKeyDown } = useSelectionHandler({ rootNodes, selectNodes, selectionMode: selectionMode ?? "single" });
  const { filteringDialog, onFilterClick } = useHierarchyLevelFiltering({
    imodel,
    defaultHierarchyLevelSizeLimit,
  });
  const reportingExpandNode = useReportingAction({ action: expandNode });
  const reportingOnFilterClicked = useReportingAction({ action: onFilterClick });
  const { getLabel } = useNodeHighlighting({ rootNodes, highlight });

  if (rootNodes === undefined) {
    return (
      <Flex alignItems="center" justifyContent="center" flexDirection="column" style={{ width: "100%", height: "100%" }}>
        <Delayed show={true}>
          <ProgressRadial size="large" />
        </Delayed>
      </Flex>
    );
  }

  if (rootNodes.length === 0 && !isLoading) {
    return (
      <Flex alignItems="center" justifyContent="center" flexDirection="column" style={{ width: "100%", height: "100%" }}>
        {noDataMessage ? noDataMessage : <Text>{TreeWidget.translate("baseTree.dataIsNotAvailable")}</Text>}
      </Flex>
    );
  }

  const treeRendererProps: FunctionProps<TreeProps["treeRenderer"]> = {
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
    <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
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

function useSelectionPredicate({
  action,
  predicate,
  getNode,
}: {
  action: (...args: any[]) => void;
  predicate?: (node: PresentationHierarchyNode) => boolean;
  getNode: (nodeId: string) => PresentationHierarchyNode | undefined;
}): ReturnType<typeof useIModelUnifiedSelectionTree>["selectNodes"] {
  return useCallback(
    (nodeIds, changeType) =>
      action(
        nodeIds.filter((nodeId) => {
          const node = getNode(nodeId);
          return node && (!predicate || predicate(node));
        }),
        changeType,
      ),
    [action, getNode, predicate],
  );
}
