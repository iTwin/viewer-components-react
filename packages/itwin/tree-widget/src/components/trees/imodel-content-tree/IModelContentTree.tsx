/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import classNames from "classnames";
import React, { useMemo } from "react";
import { ControlledTree, SelectionMode, useTreeEventsHandler, useTreeModel } from "@itwin/components-react";
import { IModelConnection } from "@itwin/core-frontend";
import { usePresentationTreeNodeLoader } from "@itwin/presentation-components";
import { AutoSizer } from "../../utils/AutoSizer";
import IMODEL_CONTENT_RULESET from "./IModelContent.json";

import type { Ruleset } from "@itwin/presentation-common";

export interface IModelContentTreeProps extends Omit<React.HTMLProps<HTMLDivElement>, "children"> {
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
