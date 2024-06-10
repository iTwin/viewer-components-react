/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback } from "react";
import { SelectionMode, TreeEventHandler } from "@itwin/components-react";
import { PresentationTree, PresentationTreeNodeRenderer, usePresentationTreeState } from "@itwin/presentation-components";
import { ReportingTreeEventHandler } from "../common/ReportingTreeEventHandler";
import { FilterableTreeRenderer, TreeRenderer } from "../common/TreeRenderer";
import { useFeatureReporting } from "../common/UseFeatureReporting";
import { usePerformanceReporting } from "../common/UsePerformanceReporting";
import { addCustomTreeNodeItemLabelRenderer, combineTreeNodeItemCustomizations } from "../common/Utils";
import * as RULESET_IMODEL_CONTENT_IMPORT from "./IModelContent.json";
import { IModelContentTreeComponent } from "./IModelContentTreeComponent";

import type { PresentationTreeEventHandlerProps } from "@itwin/presentation-components";
import type { Ruleset } from "@itwin/presentation-common";
import type { BaseTreeProps, HierarchyLevelConfig } from "../common/Types";

/**
 * Presentation rules used by IModelContentTree
 * @internal
 */
export const RULESET_IMODEL_CONTENT = RULESET_IMODEL_CONTENT_IMPORT as Ruleset;

/**
 * Props for [[IModelContentTree]].
 * @public
 */
export interface IModelContentTreeProps extends BaseTreeProps {
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
 * A tree that shows all iModel content starting from the root Subject, then the hierarchy of child
 * Subjects, their Models and Elements contained in those Models.
 * @public
 */
export const IModelContentTree = (props: IModelContentTreeProps) => {
  const { iModel, width, height, selectionMode, hierarchyLevelConfig, onFeatureUsed } = props;

  const { reportUsage } = useFeatureReporting({ treeIdentifier: IModelContentTreeComponent.id, onFeatureUsed });
  const { onNodeLoaded } = usePerformanceReporting({
    treeIdentifier: IModelContentTreeComponent.id,
    onPerformanceMeasured: props.onPerformanceMeasured,
  });

  const eventHandlerFactory = useCallback(
    (handlerProps: PresentationTreeEventHandlerProps) => {
      const nodeLoader = handlerProps.nodeLoader;
      const eventHandler = new TreeEventHandler({ modelSource: nodeLoader.modelSource, nodeLoader });
      return new ReportingTreeEventHandler({
        nodeLoader,
        eventHandler,
        reportUsage,
      });
    },
    [reportUsage],
  );

  const state = usePresentationTreeState({
    imodel: iModel,
    ruleset: RULESET_IMODEL_CONTENT,
    pagingSize: 20,
    appendChildrenCountForGroupingNodes: true,
    customizeTreeNodeItem,
    hierarchyLevelSizeLimit: hierarchyLevelConfig?.sizeLimit,
    enableHierarchyAutoUpdate: true,
    onNodeLoaded,
    eventHandlerFactory,
  });

  const treeRendererProps = {
    contextMenuItems: props.contextMenuItems,
    nodeLabelRenderer: props.nodeLabelRenderer,
    density: props.density,
  };

  if (!state) {
    return null;
  }

  return (
    <div className="tree-widget-tree-container">
      <PresentationTree
        width={width}
        height={height}
        state={state}
        selectionMode={selectionMode ?? SelectionMode.None}
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
};

const customizeTreeNodeItem = combineTreeNodeItemCustomizations([addCustomTreeNodeItemLabelRenderer]);
