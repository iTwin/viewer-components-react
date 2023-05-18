/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useState } from "react";
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
  HideNull = "hide-null",
  ShowNull = "show-null",
}

/** Data structure that defined single context menu item. */
export interface ContextMenuItemDefinition {
  key: string;
  label: string;
  title?: string;
  execute: () => void;
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
  /** Specified whether `null` values are shown in property grid. */
  showNullValues: boolean;
  /** Callback that changes whether property grid should show `null` values or not. */
  setShowNullValues: (values: boolean) => Promise<void>;
}

export type ContextMenuItemProvider = (context: MenuItemContext) => ContextMenuItemDefinition | undefined;

/** Props for configuring property grid context menu. */
export interface ContextMenuProps {
  /** List of providers used to populate context menu for current property. */
  contextMenuItemProviders?: ContextMenuItemProvider[];
}

/** Props for `useContextMenu` hook. */
export interface UseContentMenuProps extends ContextMenuProps {
  imodel: IModelConnection;
  dataProvider: IPresentationPropertyDataProvider;
  showNullValues: boolean;
  setShowNullValues: (values: boolean) => Promise<void>;
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
  setShowNullValues,
  showNullValues,
}: UseContentMenuProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuDefinition>();

  const onPropertyContextMenu = async (args: PropertyGridContextMenuArgs) => {
    args.event.persist();

    const field = await dataProvider.getFieldByPropertyDescription(args.propertyRecord.property);
    const items = (contextMenuItemProviders ?? [])
      .map((provider) => provider({ imodel, dataProvider, record: args.propertyRecord, field, showNullValues, setShowNullValues }))
      .filter((item): item is ContextMenuItemDefinition => item !== undefined);

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
    if (!field || Presentation.favoriteProperties.has(field, imodel, favoritePropertiesScope ?? FavoritePropertiesScope.IModel)) {
      return undefined;
    }

    return defaultContextMenuItemDefinitions.getAddFavoritePropertyItem(field, imodel, favoritePropertiesScope);
  };
}

export function createRemoveFavoritePropertyItemProvider(favoritePropertiesScope?: FavoritePropertiesScope): ContextMenuItemProvider {
  return ({ field, imodel }: MenuItemContext) => {
    if (!field || !Presentation.favoriteProperties.has(field, imodel, favoritePropertiesScope ?? FavoritePropertiesScope.IModel)) {
      return undefined;
    }

    return defaultContextMenuItemDefinitions.getRemoveFavoritePropertyItem(field, imodel, favoritePropertiesScope);
  };
}

export function createCopyPropertyTextItemProvider(): ContextMenuItemProvider {
  return ({ record }: MenuItemContext) => defaultContextMenuItemDefinitions.getCopyPropertyTextItem(record);
}

export function createShowNullValuesItemProvider(): ContextMenuItemProvider {
  return ({ showNullValues, setShowNullValues }: MenuItemContext) => {
    if (showNullValues) {
      return undefined;
    }

    return defaultContextMenuItemDefinitions.getShowNullValuesItem(setShowNullValues);
  };
}

export function createHideNullValuesItemProvider(): ContextMenuItemProvider {
  return ({ showNullValues, setShowNullValues }: MenuItemContext) => {
    if (!showNullValues) {
      return undefined;
    }

    return defaultContextMenuItemDefinitions.getHideNullValuesItem(setShowNullValues);
  };
}

export const defaultContextMenuItemDefinitions = {
  getAddFavoritePropertyItem: (field: Field, imodel: IModelConnection, favoritePropertiesScope?: FavoritePropertiesScope): ContextMenuItemDefinition => ({
    key: PropertyGridDefaultContextMenuKey.AddFavorite,
    execute: async () => {
      await Presentation.favoriteProperties.add(field, imodel, favoritePropertiesScope ?? FavoritePropertiesScope.IModel);
    },
    title: PropertyGridManager.translate("context-menu.add-favorite.description"),
    label: PropertyGridManager.translate("context-menu.add-favorite.label"),
  }),
  getRemoveFavoritePropertyItem: (field: Field, imodel: IModelConnection, favoritePropertiesScope?: FavoritePropertiesScope): ContextMenuItemDefinition => ({
    key: PropertyGridDefaultContextMenuKey.RemoveFavorite,
    execute: async () => {
      await Presentation.favoriteProperties.remove(field, imodel, favoritePropertiesScope ?? FavoritePropertiesScope.IModel);
    },
    title: PropertyGridManager.translate("context-menu.remove-favorite.description"),
    label: PropertyGridManager.translate("context-menu.remove-favorite.label"),
  }),
  getCopyPropertyTextItem: (record: PropertyRecord): ContextMenuItemDefinition => ({
    key: PropertyGridDefaultContextMenuKey.CopyText,
    execute: () => {
      record.description && copyToClipboard(record.description);
    },
    title: PropertyGridManager.translate("context-menu.copy-text.description"),
    label: PropertyGridManager.translate("context-menu.copy-text.label"),
  }),
  getShowNullValuesItem: (setShowNullValues: (value: boolean) => void): ContextMenuItemDefinition => ({
    key: PropertyGridDefaultContextMenuKey.ShowNull,
    execute: () => {
      setShowNullValues(true);
    },
    title: PropertyGridManager.translate("context-menu.show-null.description"),
    label: PropertyGridManager.translate("context-menu.show-null.label"),
  }),
  getHideNullValuesItem: (setShowNullValues: (value: boolean) => void): ContextMenuItemDefinition => ({
    key: PropertyGridDefaultContextMenuKey.HideNull,
    execute: () => {
      setShowNullValues(false);
    },
    title: PropertyGridManager.translate("context-menu.hide-null.description"),
    label: PropertyGridManager.translate("context-menu.hide-null.label"),
  }),
};
