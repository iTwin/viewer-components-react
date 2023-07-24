/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useMemo } from "react";
import { ControlledTree, SelectionMode, useTreeEventsHandler, useTreeModel } from "@itwin/components-react";
import { usePresentationTreeNodeLoader } from "@itwin/presentation-components";
import { TreeRenderer } from "../common/TreeRenderer";
import { addCustomTreeNodeItemLabelRenderer, combineTreeNodeItemCustomizations } from "../common/Utils";

import type { Ruleset } from "@itwin/presentation-common";
import type { BaseTreeProps } from "../common/Types";

/**
 * Presentation rules used by IModelContentTree
 * @internal
 */
export const RULESET_IMODEL_CONTENT: Ruleset = require("./IModelContent.json"); // eslint-disable-line @typescript-eslint/no-var-requires

/**
 * Props for [[IModelContentTree]].
 * @public
 */
export type IModelContentTreeProps = BaseTreeProps;

/**
 * A tree that shows all iModel content starting from the root Subject, then the hierarchy of child
 * Subjects, their Models and Elements contained in those Models.
 * @public
 */
export const IModelContentTree = (props: IModelContentTreeProps) => {
  const { iModel, width, height, selectionMode, contextMenuItems } = props;

  const { nodeLoader } = usePresentationTreeNodeLoader({
    imodel: iModel,
    ruleset: RULESET_IMODEL_CONTENT,
    pagingSize: 20,
    appendChildrenCountForGroupingNodes: true,
    customizeTreeNodeItem,
  });
  const eventHandler = useTreeEventsHandler(useMemo(() => ({ nodeLoader, modelSource: nodeLoader.modelSource }), [nodeLoader]));

  const treeModel = useTreeModel(nodeLoader.modelSource);

  return (
    <div className="imodel-content-tree">
      <ControlledTree
        width={width}
        height={height}
        nodeLoader={nodeLoader}
        selectionMode={selectionMode ?? SelectionMode.None}
        eventsHandler={eventHandler}
        model={treeModel}
        iconsEnabled={true}
        treeRenderer={(treeProps) => <TreeRenderer {...treeProps} contextMenuItems={contextMenuItems} nodeLabelRenderer={props.nodeLabelRenderer} />}
      />
    </div>
  );
};

const customizeTreeNodeItem = combineTreeNodeItemCustomizations([
  addCustomTreeNodeItemLabelRenderer,
]);
