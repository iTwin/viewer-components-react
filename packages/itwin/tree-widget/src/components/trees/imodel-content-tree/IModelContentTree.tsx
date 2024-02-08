/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { SelectionMode } from "@itwin/components-react";
import { PresentationTree, PresentationTreeNodeRenderer, usePresentationTreeState } from "@itwin/presentation-components";
import { FilterableTreeRenderer, TreeRenderer } from "../common/TreeRenderer";
import { addCustomTreeNodeItemLabelRenderer, combineTreeNodeItemCustomizations } from "../common/Utils";

import type { Ruleset } from "@itwin/presentation-common";
import type { BaseTreeProps, HierarchyLevelFilteringProps } from "../common/Types";
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
   * Props for configuring hierarchy level filtering.
   * @beta
   */
  hierarchyLevelFilteringProps?: HierarchyLevelFilteringProps;
}

/**
 * A tree that shows all iModel content starting from the root Subject, then the hierarchy of child
 * Subjects, their Models and Elements contained in those Models.
 * @public
 */
export const IModelContentTree = (props: IModelContentTreeProps) => {
  const { iModel, width, height, selectionMode, hierarchyLevelFilteringProps } = props;

  const state = usePresentationTreeState({
    imodel: iModel,
    ruleset: RULESET_IMODEL_CONTENT,
    pagingSize: 20,
    appendChildrenCountForGroupingNodes: true,
    customizeTreeNodeItem,
    hierarchyLevelSizeLimit: hierarchyLevelFilteringProps?.sizeLimit,
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
          hierarchyLevelFilteringProps ? (
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
