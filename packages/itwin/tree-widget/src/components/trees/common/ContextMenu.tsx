/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Fragment, useState } from "react";
import { ContextMenuItem, GlobalContextMenu } from "@itwin/core-react";

import type { MouseEvent, PropsWithChildren, ReactNode } from "react";
import type { TreeModelNode } from "@itwin/components-react";

/**
 * Props for single context menu item.
 * @public
 */
export interface ContextMenuItemProps {
  node: TreeModelNode;
}

/**
 * Props for configuring tree context menu.
 * @public
 */
export interface TreeContextMenuProps {
  contextMenuItems?: Array<(props: ContextMenuItemProps) => ReactNode>;
}

/**
 * Props for [[TreeContextMenuItem]] component.
 * @public
 */
export interface TreeContextMenuItemProps {
  /** Unique id of the context menu item. */
  id: string;
  /** Description of the context menu item. */
  title?: string;
  /** Callback that is invoked when context menu item is clicked. */
  onSelect: () => void;
}

/**
 * Base component for rendering single context menu item.
 * @public
 */
export function TreeContextMenuItem({ id, children, title, onSelect }: PropsWithChildren<TreeContextMenuItemProps>) {
  return (
    <ContextMenuItem key={id} onSelect={onSelect} title={title}>
      {children}
    </ContextMenuItem>
  );
}

interface ContextMenu {
  items: ReactNode[];
  position: { x: number; y: number };
}

/** @internal */
export function useContextMenu({ contextMenuItems }: TreeContextMenuProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenu>();
  const close = () => setContextMenu(undefined);

  const onContextMenu = (e: MouseEvent, node: TreeModelNode) => {
    if (!contextMenuItems) {
      return;
    }

    setContextMenu({
      items: contextMenuItems.map((item, index) => <Fragment key={index}>{item({ node })}</Fragment>),
      position: { x: e.clientX, y: e.clientY },
    });
  };

  const renderContextMenu = () => {
    if (!contextMenu) {
      return null;
    }

    return (
      <GlobalContextMenu
        identifier="tree-widget-context-menu"
        x={contextMenu.position.x}
        y={contextMenu.position.y}
        opened={true}
        onOutsideClick={close}
        onEsc={close}
        onSelect={close}
      >
        {contextMenu.items}
      </GlobalContextMenu>
    );
  };

  return {
    onContextMenu,
    renderContextMenu,
  };
}
