/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "../VisibilityTreeBase.scss";
import { useCallback } from "react";
import { SelectionMode } from "@itwin/components-react";
import {
  PresentationTree, PresentationTreeNodeRenderer, UnifiedSelectionTreeEventHandler, usePresentationTreeState,
} from "@itwin/presentation-components";
import { ReportingTreeEventHandler } from "../common/ReportingTreeEventHandler";
import { FilterableTreeRenderer, TreeRenderer } from "../common/TreeRenderer";
import { useFeatureReporting } from "../common/UseFeatureReporting";
import { usePerformanceReporting } from "../common/UsePerformanceReporting";
import { addCustomTreeNodeItemLabelRenderer, combineTreeNodeItemCustomizations } from "../common/Utils";
import * as RULESET_EXTERNAL_SOURCES_IMPORT from "./ExternalSources.json";
import { ExternalSourcesTreeComponent } from "./ExternalSourcesTreeComponent";

import type { Ruleset } from "@itwin/presentation-common";
import type { PresentationTreeEventHandlerProps } from "@itwin/presentation-components";
import type { BaseTreeProps, HierarchyLevelConfig } from "../common/Types";
/**
 * Presentation rules used by ControlledCategoriesTree
 * @internal
 */
export const RULESET_EXTERNAL_SOURCES = RULESET_EXTERNAL_SOURCES_IMPORT as Ruleset;

const PAGING_SIZE = 20;

/**
 * Props for the [[ExternalSourcesTree]] component
 * @alpha
 */
export interface ExternalSourcesTreeProps extends BaseTreeProps {
  /**
   * Props for configuring hierarchy level.
   * @beta
   */
  hierarchyLevelConfig?: HierarchyLevelConfig;
  /**
   * Reports performance of a feature.
   * @param featureId ID of the feature.
   * @param elapsedTime Elapsed time of the feature.
   * @beta
   */
  onPerformanceMeasured?: (featureId: string, elapsedTime: number) => void;
  /**
   * Callback that is invoked when a tracked feature is used.
   * @param featureId ID of the feature.
   * @beta
   */
  onFeatureUsed?: (feature: string) => void;
}

/**
 * Tree which displays a hierarchy of ExternalSources and their elements.
 * @alpha
 */
export function ExternalSourcesTree(props: ExternalSourcesTreeProps) {
  const { hierarchyLevelConfig, contextMenuItems, nodeLabelRenderer, density, onFeatureUsed } = props;

  const { reportUsage } = useFeatureReporting({ treeIdentifier: ExternalSourcesTreeComponent.id, onFeatureUsed });
  const { onNodeLoaded } = usePerformanceReporting({
    treeIdentifier: ExternalSourcesTreeComponent.id,
    onPerformanceMeasured: props.onPerformanceMeasured,
  });

  const eventHandlerFactory = useCallback(
    (handlerProps: PresentationTreeEventHandlerProps) => {
      const eventHandler = new UnifiedSelectionTreeEventHandler({ nodeLoader: handlerProps.nodeLoader });
      return new ReportingTreeEventHandler({
        nodeLoader: handlerProps.nodeLoader,
        eventHandler,
        reportUsage,
      });
    },
    [reportUsage],
  );

  const state = usePresentationTreeState({
    imodel: props.iModel,
    ruleset: RULESET_EXTERNAL_SOURCES,
    pagingSize: PAGING_SIZE,
    eventHandlerFactory,
    customizeTreeNodeItem,
    hierarchyLevelSizeLimit: hierarchyLevelConfig?.sizeLimit,
    enableHierarchyAutoUpdate: true,
    onNodeLoaded,
  });

  const treeRendererProps = {
    contextMenuItems,
    nodeLabelRenderer,
    density,
  };

  if (!state) {
    return null;
  }

  return (
    <div className="tree-widget-tree-container">
      <PresentationTree
        width={props.width}
        height={props.height}
        state={state}
        selectionMode={props.selectionMode ?? SelectionMode.Extended}
        iconsEnabled={true}
        treeRenderer={(treeProps) =>
          hierarchyLevelConfig?.isFilteringEnabled ? (
            <FilterableTreeRenderer
              {...treeProps}
              {...treeRendererProps}
              nodeLoader={state.nodeLoader}
              nodeRenderer={(nodeRendererProps) => <PresentationTreeNodeRenderer {...nodeRendererProps} />}
            />
          ) : (
            <TreeRenderer {...treeProps} {...treeRendererProps} />
          )
        }
      />
    </div>
  );
}

const customizeTreeNodeItem = combineTreeNodeItemCustomizations([
  addCustomTreeNodeItemLabelRenderer,
  (item, node) => {
    item.icon = node.extendedData?.imageId;
  },
]);
