/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

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
   * Specifies whether nodes should be exploded. Exploded nodes have bigger height and button hit boxes.
   */
  explodeNodes?: boolean;
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
export function TreeRenderer({ contextMenuItems, nodeRenderer, nodeLabelRenderer, explodeNodes, ...restProps }: TreeRendererProps) {
  const { onContextMenu, renderContextMenu } = useContextMenu({ contextMenuItems });

  const nodeHeight = explodeNodes ? () => 43 : restProps.nodeHeight;
  const className = classNames("tree-widget-tree-nodes-list", { ["explode"]: explodeNodes });

  return (
    <div className={className}>
      <ComponentsTreeRenderer
        {...restProps}
        nodeRenderer={(nodeProps) => {
          const nodeClassName = nodeProps.node.numChildren === 0 ? "without-expander" : undefined;
          return (
            <TreeNodeRendererContextProvider node={nodeProps.node} nodeLabelRenderer={nodeLabelRenderer}>
              {nodeRenderer
                ? nodeRenderer({ ...nodeProps, onContextMenu, className: nodeClassName })
                : <TreeNodeRenderer {...nodeProps} onContextMenu={onContextMenu} className={nodeClassName} />}
            </TreeNodeRendererContextProvider>
          );
        }
        }
        nodeHeight={nodeHeight}
      />
      {renderContextMenu()}
    </div>
  );
}
