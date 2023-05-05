/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import classNames from "classnames";
import React, { useMemo } from "react";
import { ControlledTree, SelectionMode, useTreeEventsHandler, useTreeModel } from "@itwin/components-react";
import { IModelConnection } from "@itwin/core-frontend";
import { Ruleset } from "@itwin/presentation-common";
import { usePresentationTreeNodeLoader } from "@itwin/presentation-components";

/**
 * Presentation rules used by IModelContentTree
 * @internal
 */
export const RULESET_IMODEL_CONTENT: Ruleset = require("./IModelContent.json"); // eslint-disable-line @typescript-eslint/no-var-requires

/**
 * Props for [[IModelContentTree]]
 * @public
 */
export interface IModelContentTreeProps extends Omit<React.HTMLProps<HTMLDivElement>, "children"> {
  /** An IModel to pull data from */
  iModel: IModelConnection;
  /** Width of the component */
  width: number;
  /** Height of the component */
  height: number;
  /** Selection mode in the tree */
  selectionMode?: SelectionMode;
}

/**
 * A tree that shows all iModel content starting from the root Subject, then the hierarchy of child
 * Subjects, their Models and Elements contained in those Models.
 * @public
 */
export const IModelContentTree = (props: IModelContentTreeProps) => {
  const { iModel, className, width, height, ...divProps } = props;

  const { nodeLoader } = usePresentationTreeNodeLoader({
    imodel: iModel,
    ruleset: RULESET_IMODEL_CONTENT,
    pagingSize: 20,
    appendChildrenCountForGroupingNodes: true,
  });
  const eventHandler = useTreeEventsHandler(useMemo(() => ({ nodeLoader, modelSource: nodeLoader.modelSource, collapsedChildrenDisposalEnabled: true }), [nodeLoader]));

  const treeModel = useTreeModel(nodeLoader.modelSource);

  return (
    <div {...divProps} className={classNames("imodel-content-tree", className)}>
      <ControlledTree
        width={width}
        height={height}
        nodeLoader={nodeLoader}
        selectionMode={props.selectionMode ?? SelectionMode.None}
        eventsHandler={eventHandler}
        model={treeModel}
        iconsEnabled={true}
      />
    </div>
  );
};
