/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./Tree.css";
import { useCallback, useMemo, useState } from "react";
import { BeEvent } from "@itwin/core-bentley";
import { SchemaMetadataContextProvider } from "@itwin/presentation-components";
import { useIModelUnifiedSelectionTree } from "@itwin/presentation-hierarchies-react";
import { TreeWidget } from "../../../../TreeWidget.js";
import { useHierarchiesLocalization } from "../internal/UseHierarchiesLocalization.js";
import { useHierarchyLevelFiltering } from "../internal/UseHierarchyFiltering.js";
import { useIModelChangeListener } from "../internal/UseIModelChangeListener.js";
import { createIModelAccess } from "../internal/Utils.js";
import { useNodeHighlighting } from "../UseNodeHighlighting.js";
import { useReportingAction, useTelemetryContext } from "../UseTelemetryContext.js";
import { LOGGING_NAMESPACE } from "../Utils.js";
import { Delayed } from "./Delayed.js";
import { EmptyTreeContent } from "./EmptyTree.js";
import { ProgressOverlay } from "./ProgressOverlay.js";
import { SkeletonTree } from "./SkeletonTree.js";

import type { ReactNode } from "react";
import type { MarkRequired } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { SchemaContext } from "@itwin/ecschema-metadata";
import type { PresentationHierarchyNode, SelectionStorage, useIModelTree, useSelectionHandler } from "@itwin/presentation-hierarchies-react";
import type { FunctionProps } from "../Utils.js";
import type { BaseTreeRendererProps } from "./BaseTreeRenderer.js";
import type { HighlightInfo } from "../UseNodeHighlighting.js";

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
          BaseTreeRendererProps,
          | "rootNodes"
          | "reloadTree"
          | "expandNode"
          | "getLabel"
          | "onFilterClick"
          | "selectNodes"
          | "selectionMode"
          | "isNodeSelected"
          | "getHierarchyLevelDetails"
          | "getLabel"
        >
      >,
    ) => ReactNode;
    /** Custom iModel access that is stored outside tree component. If not provided it new iModel access will be created using `imodel` prop. */
    imodelAccess?: FunctionProps<typeof useIModelTree>["imodelAccess"];
    /** Size limit that should be applied on each hierarchy level. Default to `1000`. */
    hierarchyLevelSizeLimit?: number;
    /** Component that should be renderer if there are no tree nodes. */
    emptyTreeContent?: ReactNode;
    /** Callback that this invoked when tree reloads. */
    onReload?: () => void;
    /** Options for highlighting node labels. */
    highlight?: HighlightInfo;
  };

/**
 * Default tree component that manages tree state and renders using supplied `treeRenderer`.
 * @beta
 */
export function Tree({ getSchemaContext, hierarchyLevelSizeLimit, selectionStorage, imodelAccess: providedIModelAccess, ...props }: TreeProps) {
  const defaultHierarchyLevelSizeLimit = hierarchyLevelSizeLimit ?? 1000;

  const imodelAccess = useMemo(() => {
    TreeWidget.logger.logInfo(
      `${LOGGING_NAMESPACE}.${props.treeName}`,
      `iModel changed, now using ${providedIModelAccess ? "provided imodel access" : `"${props.imodel.name}"`}`,
    );
    return providedIModelAccess ?? createIModelAccess({ getSchemaContext, imodel: props.imodel });
  }, [providedIModelAccess, getSchemaContext, props.imodel, props.treeName]);

  return (
    <SchemaMetadataContextProvider imodel={props.imodel} schemaContextProvider={getSchemaContext}>
      <TreeImpl {...props} selectionStorage={selectionStorage} imodelAccess={imodelAccess} defaultHierarchyLevelSizeLimit={defaultHierarchyLevelSizeLimit} />
    </SchemaMetadataContextProvider>
  );
}

function TreeImpl({
  imodel,
  imodelAccess,
  treeName,
  emptyTreeContent,
  getFilteredPaths,
  defaultHierarchyLevelSizeLimit,
  getHierarchyDefinition,
  selectionPredicate,
  selectionMode,
  onReload,
  treeRenderer,
  selectionStorage,
  highlight,
}: MarkRequired<Omit<TreeProps, "getSchemaContext">, "imodelAccess"> & { defaultHierarchyLevelSizeLimit: number }) {
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
    selectionStorage,
    onPerformanceMeasured: (action, duration) => {
      if (action === "reload") {
        onReload?.();
      }
      onPerformanceMeasured(action, duration);
    },
    onHierarchyLimitExceeded: () => onFeatureUsed({ featureId: "hierarchy-level-size-limit-hit", reportInteraction: false }),
    onHierarchyLoadError: ({ type, error }) => {
      // eslint-disable-next-line no-console
      console.error(error);
      onFeatureUsed({ featureId: `error-${type}`, reportInteraction: false });
    },
  });
  useIModelChangeListener({
    imodel,
    action: useCallback(() => {
      TreeWidget.logger.logTrace(`${LOGGING_NAMESPACE}.${treeName}`, `iModel data changed`);
      imodelChanged.raiseEvent();
    }, [imodelChanged, treeName]),
  });

  const selectNodes = useSelectionPredicate({
    action: useReportingAction({ action: selectNodesAction }),
    predicate: selectionPredicate,
    getNode,
  });
  const { filteringDialog, onFilterClick } = useHierarchyLevelFiltering({
    imodel,
    defaultHierarchyLevelSizeLimit,
  });
  const reportingExpandNode = useReportingAction({ action: expandNode });
  const reportingOnFilterClicked = useReportingAction({ action: onFilterClick });
  const { getLabel } = useNodeHighlighting({ rootNodes, highlight });

  if (rootNodes === undefined) {
    return <SkeletonTree />;
  }

  if (rootNodes.length === 0 && !isLoading) {
    return <>{emptyTreeContent ? emptyTreeContent : <EmptyTreeContent />}</>;
  }

  const treeRendererProps: FunctionProps<TreeProps["treeRenderer"]> = {
    ...treeProps,
    rootNodes,
    selectionMode: selectionMode ?? "single",
    selectNodes,
    expandNode: reportingExpandNode,
    onFilterClick: reportingOnFilterClicked,
    getLabel,
  };

  return (
    <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
      <div className={"tw-tree-renderer-container"} id="tw-tree-renderer-container">
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
