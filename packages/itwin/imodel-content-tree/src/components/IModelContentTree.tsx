/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./IModelContentTree.scss";
import classNames from "classnames";
import * as React from "react";
import { IModelConnection } from "@itwin/core-frontend";
import { Ruleset } from "@itwin/presentation-common";
import { usePresentationTreeNodeLoader } from "@itwin/presentation-components";
import { ControlledTree, SelectionMode, useTreeEventsHandler, useTreeModel } from "@itwin/components-react";
import RULESET_TREE_HIERARCHY from "./Hierarchy.json";
import { useResizeObserver } from "@itwin/core-react";

/**
 * Props for the [[IModelContentTree]] component
 */
export interface IModelContentTreeProps extends Omit<React.AllHTMLAttributes<HTMLDivElement>, "children"> {
  iModel: IModelConnection;
}

/**
 * A tree component that shows content of an iModel
 */
export function IModelContentTree(props: IModelContentTreeProps) { // eslint-disable-line @typescript-eslint/naming-convention
  const { iModel, className, ...divProps } = props;

  const [height, setHeight] = React.useState(0);
  const [width, setWidth] = React.useState(0);
  const handleResize = React.useCallback((w: number, h: number) => {
    setHeight(h);
    setWidth(w);
  }, []);
  const ref = useResizeObserver<HTMLDivElement>(handleResize);

  const { nodeLoader } = usePresentationTreeNodeLoader({
    imodel: iModel,
    ruleset: RULESET_TREE_HIERARCHY as Ruleset,
    pagingSize: 20,
    appendChildrenCountForGroupingNodes: true,
  });
  const eventHandler = useTreeEventsHandler(React.useMemo(() => ({ nodeLoader, modelSource: nodeLoader.modelSource, collapsedChildrenDisposalEnabled: true }), [nodeLoader]));

  return (
    <div ref={ref} {...divProps} className={classNames("imodel-content-tree", className)}>
      <ControlledTree
        width={width}
        height={height}
        nodeLoader={nodeLoader}
        selectionMode={SelectionMode.None}
        eventsHandler={eventHandler}
        model={useTreeModel(nodeLoader.modelSource)}
        iconsEnabled={true}
      />
    </div>
  );
}
