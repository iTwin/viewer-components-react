/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./TreeRenderer.scss";
import classNames from "classnames";
import { TreeRenderer as ComponentsTreeRenderer, TreeNodeRenderer } from "@itwin/components-react";
import { useContextMenu } from "./ContextMenu";
import { TreeNodeRendererContextProvider } from "./TreeNodeRenderer";

import type { TreeRendererProps as ComponentsTreeRendererProps } from "@itwin/components-react";
import type { TreeNodeRendererProps } from "./TreeNodeRenderer";
import type { TreeContextMenuProps } from "./ContextMenu";

/**
 * Base props for [[TreeRenderer]] component.
 * @public
 */
export interface TreeRendererBaseProps extends TreeContextMenuProps, TreeNodeRendererProps {
  /**
   * Modifies the density of tree nodes. `enlarged` tree nodes have bigger height and bigger button hit boxes.
   */
  density?: "default" | "enlarged";
}

/**
 * Props for [[TreeRenderer]] component.
 * @public
 */
export type TreeRendererProps = ComponentsTreeRendererProps & TreeRendererBaseProps;

/**
 * Base tree renderer for visibility trees.
 * @public
 */
export function TreeRenderer({ contextMenuItems, nodeRenderer, nodeLabelRenderer, density, ...restProps }: TreeRendererProps) {
  const { onContextMenu, renderContextMenu } = useContextMenu({ contextMenuItems });

  const nodeHeight = getNodeHeight(density ?? "default", restProps.nodeHeight);
  const className = classNames("tree-widget-tree-nodes-list", { ["enlarge"]: density === "enlarged" });

  return (
    <div className={className}>
      <ComponentsTreeRenderer
        {...restProps}
        nodeRenderer={(nodeProps) => {
          const nodeClassName = nodeProps.node.numChildren === 0 ? "without-expander" : undefined;
          return (
            <TreeNodeRendererContextProvider node={nodeProps.node} nodeLabelRenderer={nodeLabelRenderer}>
              {nodeRenderer ? (
                nodeRenderer({ ...nodeProps, onContextMenu, className: nodeClassName })
              ) : (
                <TreeNodeRenderer {...nodeProps} onContextMenu={onContextMenu} className={nodeClassName} />
              )}
            </TreeNodeRendererContextProvider>
          );
        }}
        nodeHeight={nodeHeight}
      />
      {renderContextMenu()}
    </div>
  );
}

function getNodeHeight(density: "default" | "enlarged", defaultHeight: ComponentsTreeRendererProps["nodeHeight"]) {
  switch (density) {
    case "default":
      return defaultHeight;
    case "enlarged":
      return () => 43;
  }
}
