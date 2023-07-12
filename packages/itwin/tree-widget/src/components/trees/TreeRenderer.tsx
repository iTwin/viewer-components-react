/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { TreeRenderer as ComponentsTreeRenderer, TreeNodeRenderer } from "@itwin/components-react";
import { useContextMenu } from "./ContextMenu";

import type { TreeRendererProps as ComponentsTreeRendererProps } from "@itwin/components-react";
import type { TreeContextMenuProps } from "./ContextMenu";

/**
 * Base props for [[TreeRenderer]] component.
 * @public
 */
export type TreeRendererBaseProps = TreeContextMenuProps;

/**
 * Props for [[TreeRenderer]] component.
 * @public
 */
export type TreeRendererProps = ComponentsTreeRendererProps & TreeRendererBaseProps;

/**
 * Base tree renderer for visibility trees.
 * @public
 */
export function TreeRenderer({ contextMenuItems, nodeRenderer, ...restProps }: TreeRendererProps) {
  const { onContextMenu, renderContextMenu } = useContextMenu({ contextMenuItems });

  return (
    <>
      <ComponentsTreeRenderer
        {...restProps}
        nodeRenderer={(nodeProps) => nodeRenderer
          ? nodeRenderer({ ...nodeProps, onContextMenu })
          : <TreeNodeRenderer {...nodeProps} onContextMenu={onContextMenu} />
        }
      />
      {renderContextMenu()}
    </>
  );
}
