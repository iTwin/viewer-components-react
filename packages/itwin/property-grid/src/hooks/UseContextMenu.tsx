/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useState } from "react";
import { assert } from "@itwin/core-bentley";
import { ContextMenuItem, GlobalContextMenu } from "@itwin/core-react";
import { FavoritePropertiesScope, Presentation } from "@itwin/presentation-frontend";
import { copyToClipboard } from "../api/WebUtilities";
import { PropertyGridManager } from "../PropertyGridManager";

import type { PropertyRecord } from "@itwin/appui-abstract";
import type { Field } from "@itwin/presentation-common";
import type { IPresentationPropertyDataProvider } from "@itwin/presentation-components";
import type { PropertyGridContextMenuArgs } from "@itwin/components-react";
import type { IModelConnection } from "@itwin/core-frontend";

export enum PropertyGridDefaultContextMenuKey {
  RemoveFavorite = "remove-favorite",
  AddFavorite = "add-favorite",
  CopyText = "copy-text",
}

/** Data structure that defined single context menu item. */
export interface ContextMenuItemDefinition {
  key: string;
  label: string;
  title?: string;
  execute: () => void;
  hidden?: boolean;
}

/** Context provided to menu items for performing actions and determining if item should be shown. */
export interface MenuItemContext {
  /** iModelConnection used by property grid. */
  imodel: IModelConnection;
  /** Data provider used by property grid. */
  dataProvider: IPresentationPropertyDataProvider;
  /** Property record for which menu is opened. */
  record: PropertyRecord;
  /** Field for which context menu is opened. */
  field: Field | undefined;
}

/** Type definition for context menu item provider. */
export type ContextMenuItemProvider = (context: MenuItemContext) => ContextMenuItemDefinition;

/** Props for configuring property grid context menu. */
export interface ContextMenuProps {
  /** List of providers used to populate context menu for current property. */
  contextMenuItemProviders?: ContextMenuItemProvider[];
}

/** Props for `useContextMenu` hook. */
export interface UseContentMenuProps extends ContextMenuProps {
  imodel: IModelConnection;
  dataProvider: IPresentationPropertyDataProvider;
}

interface ContextMenuDefinition {
  position: { x: number, y: number };
  menuItems: ContextMenuItemDefinition[];
}

/** Custom hook for rendering property grid context menu. */
export function useContextMenu({
  dataProvider,
  imodel,
  contextMenuItemProviders,
}: UseContentMenuProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuDefinition>();

  const onPropertyContextMenu = async (args: PropertyGridContextMenuArgs) => {
    args.event.persist();

    const field = await dataProvider.getFieldByPropertyDescription(args.propertyRecord.property);
    const items = (contextMenuItemProviders ?? []).map((provider) => provider({ imodel, dataProvider, record: args.propertyRecord, field }));

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

    const items = contextMenu.menuItems.map((item) => (
      <ContextMenuItem
        key={item.key}
        onSelect={() => {
          item.execute();
          setContextMenu(undefined);
        }}
        title={item.title}
        hidden={item.hidden}
      >
        {item.label}
      </ContextMenuItem>
    ));

    return (
      <GlobalContextMenu
        opened={true}
        onOutsideClick={() => {
          setContextMenu(undefined);
        }}
        onEsc={() => {
          setContextMenu(undefined);
        }}
        identifier="PropertiesWidget"
        x={contextMenu.position.x}
        y={contextMenu.position.y}
      >
        {items}
      </GlobalContextMenu>
    );
  };

  return {
    onPropertyContextMenu,
    renderContextMenu,
  };
}

export function createAddFavoritePropertyItemProvider(favoritePropertiesScope?: FavoritePropertiesScope): ContextMenuItemProvider {
  return ({ field, imodel }: MenuItemContext) => {
    const hidden = !field || Presentation.favoriteProperties.has(field, imodel, favoritePropertiesScope ?? FavoritePropertiesScope.IModel);
    return {
      key: PropertyGridDefaultContextMenuKey.AddFavorite,
      execute: async () => {
        assert(field !== undefined);
        await Presentation.favoriteProperties.add(field, imodel, favoritePropertiesScope ?? FavoritePropertiesScope.IModel);
      },
      title: PropertyGridManager.translate("context-menu.add-favorite.description"),
      label: PropertyGridManager.translate("context-menu.add-favorite.label"),
      hidden,
    };
  };
}

export function createRemoveFavoritePropertyItemProvider(favoritePropertiesScope?: FavoritePropertiesScope): ContextMenuItemProvider {
  return ({ field, imodel }: MenuItemContext) => {
    const hidden = !field || !Presentation.favoriteProperties.has(field, imodel, favoritePropertiesScope ?? FavoritePropertiesScope.IModel);
    return {
      key: PropertyGridDefaultContextMenuKey.RemoveFavorite,
      execute: async () => {
        assert(field !== undefined);
        await Presentation.favoriteProperties.remove(field, imodel, favoritePropertiesScope ?? FavoritePropertiesScope.IModel);
      },
      title: PropertyGridManager.translate("context-menu.remove-favorite.description"),
      label: PropertyGridManager.translate("context-menu.remove-favorite.label"),
      hidden,
    };
  };
}

export function createCopyPropertyTextItemProvider(): ContextMenuItemProvider {
  return ({ record }: MenuItemContext) => ({
    key: PropertyGridDefaultContextMenuKey.CopyText,
    execute: () => {
      record.description && copyToClipboard(record.description);
    },
    title: PropertyGridManager.translate("context-menu.copy-text.description"),
    label: PropertyGridManager.translate("context-menu.copy-text.label"),
  });
}
