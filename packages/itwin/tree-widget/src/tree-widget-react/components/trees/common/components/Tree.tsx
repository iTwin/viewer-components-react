/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./Tree.css";
import { useCallback, useState } from "react";
import { BeEvent } from "@itwin/core-bentley";
import { SchemaMetadataContextProvider } from "@itwin/presentation-components";
import { StrataKitRootErrorRenderer, useIModelUnifiedSelectionTree } from "@itwin/presentation-hierarchies-react";
import { TreeWidget } from "../../../../TreeWidget.js";
import { useHierarchiesLocalization } from "../internal/UseHierarchiesLocalization.js";
import { useHierarchyLevelFiltering } from "../internal/UseHierarchyFiltering.js";
import { useIModelAccess } from "../internal/UseIModelAccess.js";
import { useIModelChangeListener } from "../internal/UseIModelChangeListener.js";
import { useNodeHighlighting } from "../UseNodeHighlighting.js";
import { useReportingAction, useTelemetryContext } from "../UseTelemetryContext.js";
import { LOGGING_NAMESPACE } from "../Utils.js";
import { Delayed } from "./Delayed.js";
import { EmptyTreeContent } from "./EmptyTree.js";
import { ProgressOverlay } from "./ProgressOverlay.js";
import { SkeletonTree } from "./SkeletonTree.js";

import type { ReactNode } from "react";
import type { IModelConnection } from "@itwin/core-frontend";
import type {
  PresentationHierarchyNode,
  SelectionStorage,
  TreeRendererProps,
  useIModelTree,
  useSelectionHandler,
  useTree,
} from "@itwin/presentation-hierarchies-react";
import type { FunctionProps } from "../Utils.js";
import type { BaseTreeRendererProps } from "./BaseTreeRenderer.js";
import type { HighlightInfo } from "../UseNodeHighlighting.js";

/** @beta */
export type TreeProps = Pick<FunctionProps<typeof useIModelTree>, "getFilteredPaths" | "getHierarchyDefinition"> &
  Partial<Pick<FunctionProps<typeof useSelectionHandler>, "selectionMode">> & {
    /** iModel connection that should be used to pull data from. */
    imodel: IModelConnection;
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
      treeProps: Required<Pick<BaseTreeRendererProps, "getLabel" | "onFilterClick" | "selectionMode" | "getLabel"> & TreeRendererProps>,
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
export function Tree({
  hierarchyLevelSizeLimit,
  getHierarchyDefinition,
  getFilteredPaths,
  selectionStorage,
  imodelAccess: providedIModelAccess,
  treeName,
  onReload,
  ...props
}: TreeProps) {
  const { onFeatureUsed, onPerformanceMeasured } = useTelemetryContext();
  const [imodelChanged] = useState(new BeEvent<() => void>());
  const localizedStrings = useHierarchiesLocalization();

  const { imodelAccess, currentHierarchyLevelSizeLimit } = useIModelAccess({
    imodel: props.imodel,
    imodelAccess: providedIModelAccess,
    treeName,
    hierarchyLevelSizeLimit,
  });

  const {
    getNode,
    setFormatter: _setFormatter,
    isReloading,
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
    imodel: props.imodel,
    action: useCallback(() => {
      TreeWidget.logger.logTrace(`${LOGGING_NAMESPACE}.${treeName}`, `iModel data changed`);
      imodelChanged.raiseEvent();
    }, [imodelChanged, treeName]),
  });

  if (treeProps.rootErrorRendererProps !== undefined) {
    return <StrataKitRootErrorRenderer {...treeProps.rootErrorRendererProps} />;
  }

  return (
    <TreeBase
      {...props}
      isReloading={isReloading}
      treeRendererProps={treeProps.treeRendererProps}
      getNode={getNode}
      currentHierarchyLevelSizeLimit={currentHierarchyLevelSizeLimit}
    />
  );
}

type TreeBaseProps = {
  currentHierarchyLevelSizeLimit: number;
  getNode: (nodeId: string) => PresentationHierarchyNode | undefined;
  treeRendererProps?: TreeRendererProps;
} & Omit<TreeProps, "selectionStorage" | "treeName" | "getHierarchyDefinition"> &
  Pick<ReturnType<typeof useTree>, "getNode" | "isReloading">;

/** @internal */
function TreeBase({ treeRendererProps, ...props }: TreeBaseProps) {
  const getSchemaContext = useCallback(() => props.imodel.schemaContext, [props.imodel]);

  if (treeRendererProps === undefined) {
    return <SkeletonTree />;
  }

  return (
    <SchemaMetadataContextProvider imodel={props.imodel} schemaContextProvider={getSchemaContext}>
      <TreeBaseImpl {...props} treeRendererProps={treeRendererProps} />
    </SchemaMetadataContextProvider>
  );
}

function TreeBaseImpl({
  imodel,
  emptyTreeContent,
  currentHierarchyLevelSizeLimit,
  selectionPredicate,
  selectionMode,
  treeRenderer,
  highlight,
  treeRendererProps,
  isReloading,
  getNode,
}: Omit<TreeBaseProps, "getSchemaContext" | "treeRendererProps"> & Required<Pick<TreeBaseProps, "treeRendererProps">>) {
  const selectNodes = useSelectionPredicate({
    action: useReportingAction({ action: treeRendererProps.selectNodes }),
    predicate: selectionPredicate,
    getNode,
  });
  const { filteringDialog, onFilterClick } = useHierarchyLevelFiltering({
    imodel,
    defaultHierarchyLevelSizeLimit: currentHierarchyLevelSizeLimit,
  });
  const reportingExpandNode = useReportingAction({ action: treeRendererProps.expandNode });
  const reportingOnFilterClicked = useReportingAction({ action: onFilterClick });
  const { getLabel } = useNodeHighlighting({ rootNodes: treeRendererProps.rootNodes, highlight });

  if (treeRendererProps.rootNodes.length === 0 && !isReloading) {
    return <>{emptyTreeContent ? emptyTreeContent : <EmptyTreeContent />}</>;
  }

  const treeRenderProps: FunctionProps<TreeProps["treeRenderer"]> = {
    ...treeRendererProps,
    selectNodes,
    selectionMode: selectionMode ?? "single",
    expandNode: reportingExpandNode,
    onFilterClick: reportingOnFilterClicked,
    getLabel,
  };

  return (
    <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
      <div className={"tw-tree-renderer-container"} id="tw-tree-renderer-container">
        {treeRenderer(treeRenderProps)}
        {filteringDialog}
      </div>
      <Delayed show={isReloading}>
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
}): TreeRendererProps["selectNodes"] {
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
