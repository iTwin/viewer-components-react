/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "../VisibilityTreeBase.scss";
import { ControlledTree, SelectionMode, useTreeModel } from "@itwin/components-react";
import { usePresentationTreeNodeLoader, useUnifiedSelectionTreeEventHandler } from "@itwin/presentation-components";
import { TreeRenderer } from "../common/TreeRenderer";
import { addCustomTreeNodeItemLabelRenderer, combineTreeNodeItemCustomizations } from "../common/Utils";
import * as RULESET_EXTERNAL_SOURCES_IMPORT from "./ExternalSources.json";

import type { Ruleset } from "@itwin/presentation-common";
import type { BaseTreeProps } from "../common/Types";
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
export type ExternalSourcesTreeProps = BaseTreeProps;

/**
 * Tree which displays a hierarchy of ExternalSources and their elements.
 * @alpha
 */
export function ExternalSourcesTree(props: ExternalSourcesTreeProps) {
  const { nodeLoader } = usePresentationTreeNodeLoader({
    imodel: props.iModel,
    ruleset: RULESET_EXTERNAL_SOURCES,
    pagingSize: PAGING_SIZE,
    customizeTreeNodeItem,
  });
  const eventsHandler = useUnifiedSelectionTreeEventHandler({ nodeLoader });
  const treeModel = useTreeModel(nodeLoader.modelSource);
  return (
    <div className="tree-widget-tree-container">
      <ControlledTree
        nodeLoader={nodeLoader}
        model={treeModel}
        selectionMode={props.selectionMode ?? SelectionMode.Extended}
        eventsHandler={eventsHandler}
        width={props.width}
        height={props.height}
        iconsEnabled={true}
        treeRenderer={(treeProps) =>
          <TreeRenderer
            {...treeProps}
            contextMenuItems={props.contextMenuItems}
            nodeLabelRenderer={props.nodeLabelRenderer}
            explodeNodes={props.explodeNodes}
          />
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
