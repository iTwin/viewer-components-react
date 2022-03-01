/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import classNames from "classnames";
import React, { useCallback, useMemo, useState } from "react";
import type { IModelConnection } from "@itwin/core-frontend";
import type { Ruleset } from "@itwin/presentation-common";
import { usePresentationTreeNodeLoader } from "@itwin/presentation-components";
import { ControlledTree, SelectionMode, useTreeEventsHandler, useTreeModel } from "@itwin/components-react";
import IMODEL_CONTENT_RULESET from "../rulesets/IModelContent.json";
import { useResizeObserver } from "@itwin/core-react";

export interface IModelContentTreeProps extends Omit<React.AllHTMLAttributes<HTMLDivElement>, "children"> {
  iModel: IModelConnection;
}

export const IModelContentTree = (props: IModelContentTreeProps) => {
  const { iModel, className, ...divProps } = props;

  const [height, setHeight] = useState(0);
  const [width, setWidth] = useState(0);
  const handleResize = useCallback((w: number, h: number) => {
    setHeight(h);
    setWidth(w);
  }, []);
  const ref = useResizeObserver<HTMLDivElement>(handleResize);

  const { nodeLoader } = usePresentationTreeNodeLoader({
    imodel: iModel,
    ruleset: IMODEL_CONTENT_RULESET as Ruleset,
    pagingSize: 20,
    appendChildrenCountForGroupingNodes: true,
  });
  const eventHandler = useTreeEventsHandler(useMemo(() => ({ nodeLoader, modelSource: nodeLoader.modelSource, collapsedChildrenDisposalEnabled: true }), [nodeLoader]));

  return (
    <div ref={ref} style={{ width: "100%", height: "100%" }} {...divProps} className={classNames("imodel-content-tree", className)}>
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
};
