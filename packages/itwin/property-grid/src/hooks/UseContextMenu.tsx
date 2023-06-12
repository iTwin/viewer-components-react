/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useState } from "react";
import { assert } from "@itwin/core-bentley";
import { ContextMenuItem as CoreContextMenuItem, GlobalContextMenu } from "@itwin/core-react";
import { FavoritePropertiesScope, Presentation } from "@itwin/presentation-frontend";
import { copyToClipboard } from "../api/WebUtilities";
import { PropertyGridManager } from "../PropertyGridManager";

import type { PropsWithChildren, ReactNode } from "react";
import type { PropertyRecord } from "@itwin/appui-abstract";
import type { Field } from "@itwin/presentation-common";
import type { IPresentationPropertyDataProvider } from "@itwin/presentation-components";
import type { PropertyGridContextMenuArgs } from "@itwin/components-react";
import type { IModelConnection } from "@itwin/core-frontend";

/**
 * Props for single context menu item.
 * @public
 */
export interface ContextMenuItemProps {
  /** iModelConnection used by property grid. */
  imodel: IModelConnection;
  /** Data provider used by property grid. */
  dataProvider: IPresentationPropertyDataProvider;
  /** Property record for which menu is opened. */
  record: PropertyRecord;
  /** Field for which context menu is opened. */
  field: Field | undefined;
}

/**
 * Props for configuring property grid context menu.
 * @public
 */
export interface ContextMenuProps {
  /** List of items to render in context menu. For consistent style recommend using `PropertyGridContextMenuItem` component. */
  contextMenuItems?: Array<(props: ContextMenuItemProps) => ReactNode>;
}

/**
 * Props for `PropertyGridContextMenuItem`.
 * @public
 */
export interface PropertyGridContextMenuItemProps {
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
export function PropertyGridContextMenuItem({ id, children, title, onSelect }: PropsWithChildren<PropertyGridContextMenuItemProps>) {
  return <CoreContextMenuItem
    key={id}
    onSelect={onSelect}
    title={title}
  >
    {children}
  </CoreContextMenuItem>;
}

/**
 * Props for `Add/Remove` favorite properties context menu items.
 */
export interface FavoritePropertiesContextMenuItemProps extends ContextMenuItemProps {
  /** Scope in which favorite property should be stored. Defaults to `FavoritePropertiesScope.IModel`. */
  scope?: FavoritePropertiesScope;
}

/**
 * Renders `Add to Favorite` context menu item if property field is not favorite. Otherwise renders nothing.
 * @public
 */
export function AddFavoritePropertyMenuItem({ field, imodel, scope }: FavoritePropertiesContextMenuItemProps) {
  const currentScope = scope ?? FavoritePropertiesScope.IModel;
  if (!field || Presentation.favoriteProperties.has(field, imodel, currentScope)) {
    return null;
  }

  return (
    <PropertyGridContextMenuItem
      id="add-favorite"
      onSelect={async () => {
        assert(field !== undefined);
        await Presentation.favoriteProperties.add(field, imodel, currentScope);
      }}
      title={PropertyGridManager.translate("context-menu.add-favorite.description")}
    >
      {PropertyGridManager.translate("context-menu.add-favorite.label")}
    </PropertyGridContextMenuItem>
  );
}

/**
 * Renders `Remove from Favorite` context menu item if property field is favorite. Otherwise renders nothing.
 * @public
 */
export function RemoveFavoritePropertyMenuItem({ field, imodel, scope }: FavoritePropertiesContextMenuItemProps) {
  const currentScope = scope ?? FavoritePropertiesScope.IModel;
  if (!field || !Presentation.favoriteProperties.has(field, imodel, currentScope)) {
    return null;
  }

  return (
    <PropertyGridContextMenuItem
      id="remove-favorite"
      onSelect={async () => {
        assert(field !== undefined);
        await Presentation.favoriteProperties.remove(field, imodel, currentScope);
      }}
      title={PropertyGridManager.translate("context-menu.remove-favorite.description")}
    >
      {PropertyGridManager.translate("context-menu.remove-favorite.label")}
    </PropertyGridContextMenuItem>
  );
}

/**
 * Renders `Copy Text` context menu item.
 * @public
 */
export function CopyPropertyTextMenuItem({ record }: ContextMenuItemProps) {
  return (
    <PropertyGridContextMenuItem
      id="copy-text"
      onSelect={async () => {
        record.description && copyToClipboard(record.description);
      }}
      title={PropertyGridManager.translate("context-menu.copy-text.description")}
    >
      {PropertyGridManager.translate("context-menu.copy-text.label")}
    </PropertyGridContextMenuItem>
  );
}

/**
 * Props for `useContextMenu` hook.
 * @internal
 */
export interface UseContentMenuProps extends ContextMenuProps {
  imodel: IModelConnection;
  dataProvider: IPresentationPropertyDataProvider;
}

interface ContextMenuDefinition {
  position: { x: number, y: number };
  menuItems: ReactNode[];
}

/**
 * Custom hook for rendering property grid context menu.
 * @internal
 */
export function useContextMenu({ dataProvider, imodel, contextMenuItems }: UseContentMenuProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuDefinition>();

  const onPropertyContextMenu = async (args: PropertyGridContextMenuArgs) => {
    args.event.persist();
    if (!contextMenuItems || contextMenuItems.length === 0) {
      return;
    }

    const field = await dataProvider.getFieldByPropertyDescription(args.propertyRecord.property);
    const items = contextMenuItems.map((item) => item({ imodel, dataProvider, record: args.propertyRecord, field })).filter((item) => !!item);

    setContextMenu(
      items.length > 0
        ? {
          position: { x: args.event.clientX, y: args.event.clientY },
          menuItems: items,
        }
        : undefined
    );
  };

  const renderContextMenu = () => {
    if (!contextMenu) {
      return undefined;
    }

    const close = () => setContextMenu(undefined);
    return (
      <GlobalContextMenu
        opened={true}
        onOutsideClick={close}
        onEsc={close}
        onSelect={close}
        identifier="PropertiesWidget"
        x={contextMenu.position.x}
        y={contextMenu.position.y}
      >
        {contextMenu.menuItems}
      </GlobalContextMenu>
    );
  };

  return {
    onPropertyContextMenu,
    renderContextMenu,
  };
}
