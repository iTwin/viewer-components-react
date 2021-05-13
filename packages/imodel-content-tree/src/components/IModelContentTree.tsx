/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./IModelContentTree.scss";
import classNames from "classnames";
import * as React from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Ruleset } from "@bentley/presentation-common";
import { usePresentationTreeNodeLoader } from "@bentley/presentation-components";
import { ControlledTree, SelectionMode, useTreeEventsHandler, useVisibleTreeNodes } from "@bentley/ui-components";
import RULESET_TREE_HIERARCHY from "./Hierarchy.json";

/** Props for the [[IModelContentTree]] component */
export interface IModelContentTreeProps extends Omit<React.AllHTMLAttributes<HTMLDivElement>, "children"> {
  iModel: IModelConnection;
}

/**
 * A tree component that shows content of an iModel
 */
export function IModelContentTree(props: IModelContentTreeProps) {
  const { iModel, className, ...divProps } = props;
  const { nodeLoader } = usePresentationTreeNodeLoader({
    imodel: iModel,
    ruleset: RULESET_TREE_HIERARCHY as Ruleset,
    pagingSize: 20,
    appendChildrenCountForGroupingNodes: true,
  });
  const eventHandler = useTreeEventsHandler(React.useMemo(() => ({ nodeLoader, modelSource: nodeLoader.modelSource, collapsedChildrenDisposalEnabled: true }), [nodeLoader]));
  return (
    <div {...divProps} className={classNames("imodel-content-tree", className)}>
      <ControlledTree
        nodeLoader={nodeLoader}
        selectionMode={SelectionMode.None}
        treeEvents={eventHandler}
        visibleNodes={useVisibleTreeNodes(nodeLoader.modelSource)}
        iconsEnabled={true}
      />
    </div>
  );
}
