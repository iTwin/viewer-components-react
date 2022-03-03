/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useMemo } from "react";
import type { IModelConnection } from "@itwin/core-frontend";
import type { Ruleset } from "@itwin/presentation-common";
import { usePresentationTreeNodeLoader } from "@itwin/presentation-components";
import { ControlledTree, SelectionMode, useTreeEventsHandler, useTreeModel } from "@itwin/components-react";
import IMODEL_CONTENT_RULESET from "../rulesets/IModelContent.json";
import { AutoSizer } from "./AutoSizer";
import classNames from "classnames";

export interface IModelContentTreeProps extends Omit<React.AllHTMLAttributes<HTMLDivElement>, "children"> {
  iModel: IModelConnection;
}

export const IModelContentTree = (props: IModelContentTreeProps) => {
  const { iModel, className, ...divProps } = props;

  const { nodeLoader } = usePresentationTreeNodeLoader({
    imodel: iModel,
    ruleset: IMODEL_CONTENT_RULESET as Ruleset,
    pagingSize: 20,
    appendChildrenCountForGroupingNodes: true,
  });
  const eventHandler = useTreeEventsHandler(useMemo(() => ({ nodeLoader, modelSource: nodeLoader.modelSource, collapsedChildrenDisposalEnabled: true }), [nodeLoader]));

  const treeModel = useTreeModel(nodeLoader.modelSource);

  return (
    <AutoSizer>
      {({ width, height }) => (
        <div {...divProps} className={classNames("imodel-content-tree", className)}>
          <ControlledTree
            width={width}
            height={height}
            nodeLoader={nodeLoader}
            selectionMode={SelectionMode.None}
            eventsHandler={eventHandler}
            model={treeModel}
            iconsEnabled={true}
          />
        </div>
      )}
    </AutoSizer>
  );
};
