/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { TreeRenderer as ComponentsTreeRenderer, TreeNodeRenderer } from "@itwin/components-react";
import { useContextMenu } from "./ContextMenu";
import { TreeNodeRendererContextProvider } from "./TreeNodeRenderer";

import type { TreeRendererProps as ComponentsTreeRendererProps } from "@itwin/components-react";
import type { TreeContextMenuProps } from "./ContextMenu";
import type { TreeNodeRendererContext } from "./TreeNodeRenderer";

/**
 * Base props for [[TreeRenderer]] component.
 * @public
 */
export type TreeRendererBaseProps = TreeContextMenuProps & TreeNodeRendererContext;

/**
 * Props for [[TreeRenderer]] component.
 * @public
 */
export type TreeRendererProps = ComponentsTreeRendererProps & TreeRendererBaseProps;

/**
 * Base tree renderer for visibility trees.
 * @public
 */
export function TreeRenderer({ contextMenuItems, nodeRenderer, nodeLabelRenderer, ...restProps }: TreeRendererProps) {
  const { onContextMenu, renderContextMenu } = useContextMenu({ contextMenuItems });

  return (
    <>
      <ComponentsTreeRenderer
        {...restProps}
        nodeRenderer={(nodeProps) =>
          <TreeNodeRendererContextProvider node={nodeProps.node} nodeLabelRenderer={nodeLabelRenderer}>
            {nodeRenderer
              ? nodeRenderer({ ...nodeProps, onContextMenu })
              : <TreeNodeRenderer {...nodeProps} onContextMenu={onContextMenu} />}
          </TreeNodeRendererContextProvider>
        }
      />
      {renderContextMenu()}
    </>
  );
}
