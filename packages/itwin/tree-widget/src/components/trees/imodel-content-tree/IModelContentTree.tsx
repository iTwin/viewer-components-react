/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { SelectionMode } from "@itwin/components-react";
import { PresentationTree, PresentationTreeNodeRenderer, usePresentationTreeState } from "@itwin/presentation-components";
import { FilterableTreeRenderer, TreeRenderer } from "../common/TreeRenderer";
import { usePerformanceReporting } from "../common/UsePerformanceReporting";
import { addCustomTreeNodeItemLabelRenderer, combineTreeNodeItemCustomizations } from "../common/Utils";
import { IModelContentTreeComponent } from "./IModelContentTreeComponent";

import type { Ruleset } from "@itwin/presentation-common";
import type { BaseTreeProps, HierarchyLevelConfig } from "../common/Types";
/**
 * Presentation rules used by IModelContentTree
 * @internal
 */
export const RULESET_IMODEL_CONTENT: Ruleset = require("./IModelContent.json"); // eslint-disable-line @typescript-eslint/no-var-requires

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
}

/**
 * A tree that shows all iModel content starting from the root Subject, then the hierarchy of child
 * Subjects, their Models and Elements contained in those Models.
 * @public
 */
export const IModelContentTree = (props: IModelContentTreeProps) => {
  const { iModel, width, height, selectionMode, hierarchyLevelConfig } = props;

  const reporting = usePerformanceReporting({
    treeIdentifier: IModelContentTreeComponent.id,
    iModel: props.iModel,
    onPerformanceMeasured: props.onPerformanceMeasured,
  });

  const state = usePresentationTreeState({
    imodel: iModel,
    ruleset: RULESET_IMODEL_CONTENT,
    pagingSize: 20,
    appendChildrenCountForGroupingNodes: true,
    customizeTreeNodeItem,
    hierarchyLevelSizeLimit: hierarchyLevelConfig?.sizeLimit,
    enableHierarchyAutoUpdate: true,
    onNodeLoaded: reporting.onNodeLoaded,
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
