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
import type { ContextMenuItemProps } from "@itwin/core-react";
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

export type ContextMenuItemInfo = ContextMenuItemProps & {
  key?: string | number;
  label: string;
  isValid?: (record: PropertyRecord, field?: Field) => boolean;
  forcePosition?: number;
};

/** Props for configuring property grid context menu. */
export interface ContextMenuProps {
  /** Specifies scope where favorite properties are stored. Defaults to `iModel`. */
  favoritePropertiesScope?: FavoritePropertiesScope;
  /** Specifies whether context menu option for favoriting properties should be shown. Defaults to `false`. */
  enableFavoriteProperties?: boolean;
  /** Specifies whether context menu option for copying property text should be shown. Defaults to `false`. */
  enableCopyingPropertyText?: boolean;
  /** Specifies whether context menu option for showing/hiding null values should be shown. Defaults to `false`. */
  enableNullValueToggle?: boolean;
  /** Additional context menu options that should be added. */
  additionalContextMenuOptions?: ContextMenuItemInfo[];
  /** Overrides for default property grid context menu options. */
  defaultContextMenuOptions?: Map<PropertyGridDefaultContextMenuKey, Partial<ContextMenuItemInfo>>;
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
  menuItems: ContextMenuItemInfo[];
}

interface OnSelectEventArgs {
  dataProvider: IPresentationPropertyDataProvider;
  field?: Field;
  contextMenuArgs: PropertyGridContextMenuArgs;
}

/** Custom hook for rendering property grid context menu. */
export function useContextMenu({
  dataProvider,
  imodel,
  enableCopyingPropertyText,
  enableFavoriteProperties,
  additionalContextMenuOptions,
  defaultContextMenuOptions,
  enableNullValueToggle,
  favoritePropertiesScope,
  setShowNullValues,
  showNullValues,
}: UseContentMenuProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuDefinition>();

  const onPropertyContextMenu = async (args: PropertyGridContextMenuArgs) => {
    args.event.persist();
    const items = await buildMenuItems({
      args,
      dataProvider,
      imodel,
      enableFavoriteProperties,
      setShowNullValues,
      showNullValues,
      enableNullValueToggle,
      additionalContextMenuOptions,
      defaultContextMenuOptions,
      enableCopyingPropertyText,
      favoritePropertiesScope,
    });

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
        onSelect={(e) => {
          item.onSelect && item.onSelect(e);
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

interface BuildMenuItemsProps extends UseContentMenuProps {
  args: PropertyGridContextMenuArgs;
}

async function buildMenuItems({
  args,
  imodel,
  dataProvider,
  enableFavoriteProperties,
  favoritePropertiesScope,
  setShowNullValues,
  showNullValues,
  enableNullValueToggle,
  enableCopyingPropertyText,
  additionalContextMenuOptions,
  defaultContextMenuOptions,
}: BuildMenuItemsProps) {
  const items: ContextMenuItemInfo[] = [];
  const propertyRecord = args.propertyRecord;
  const field = await dataProvider.getFieldByPropertyDescription(propertyRecord.property);

  if (enableFavoriteProperties && field) {
    if (Presentation.favoriteProperties.has(field, imodel, favoritePropertiesScope ?? FavoritePropertiesScope.IModel)) {
      items.push({
        key: PropertyGridDefaultContextMenuKey.RemoveFavorite,
        onSelect: async () => {
          await Presentation.favoriteProperties.remove(field, imodel, favoritePropertiesScope ?? FavoritePropertiesScope.IModel);
        },
        title: PropertyGridManager.translate("context-menu.remove-favorite.description"),
        label: PropertyGridManager.translate("context-menu.remove-favorite.label"),
      });
    } else {
      items.push({
        key: PropertyGridDefaultContextMenuKey.AddFavorite,
        onSelect: async () => {
          await Presentation.favoriteProperties.add(field, imodel, favoritePropertiesScope ?? FavoritePropertiesScope.IModel);
        },
        title: PropertyGridManager.translate("context-menu.add-favorite.description"),
        label: PropertyGridManager.translate("context-menu.add-favorite.label"),
      });
    }
  }

  if (enableCopyingPropertyText) {
    items.push({
      key: PropertyGridDefaultContextMenuKey.CopyText,
      onSelect: () => {
        propertyRecord.description && copyToClipboard(propertyRecord.description);
      },
      title: PropertyGridManager.translate("context-menu.copy-text.description"),
      label: PropertyGridManager.translate("context-menu.copy-text.label"),
    });
  }

  if (enableNullValueToggle) {
    if (showNullValues) {
      items.push({
        key: PropertyGridDefaultContextMenuKey.HideNull,
        onSelect: async () => {
          await setShowNullValues(false);
        },
        title: PropertyGridManager.translate("context-menu.hide-null.description"),
        label: PropertyGridManager.translate("context-menu.hide-null.label"),
      });
    } else {
      items.push({
        key: PropertyGridDefaultContextMenuKey.ShowNull,
        onSelect: async () => {
          await setShowNullValues(true);
        },
        title: PropertyGridManager.translate("context-menu.show-null.description"),
        label: PropertyGridManager.translate("context-menu.show-null.label"),
      });
    }
  }

  if (additionalContextMenuOptions?.length) {
    for (const option of additionalContextMenuOptions) {
      const newItem = {
        ...option,
        key: `additionalContextMenuOption_${option.label}`,
        onSelect: () => {
          if (option.onSelect) {
            (option.onSelect as (args: OnSelectEventArgs) => void)({
              contextMenuArgs: args,
              field,
              dataProvider,
            });
          }
        },
      };
      // If option needs to go in a specific position in the list, put it there. otherwise just push.
      if (option.forcePosition !== undefined) {
        items.splice(option.forcePosition, 0, newItem);
      } else {
        items.push(newItem);
      }
    }
  }

  // Do any overrides on default menu options
  if (defaultContextMenuOptions?.size && defaultContextMenuOptions.size > 0) {
    for (const key of Object.values(PropertyGridDefaultContextMenuKey)) {
      const overrides = defaultContextMenuOptions?.get(key);
      if (overrides) {
        const itemIndex = items.map((item) => item.key).indexOf(key);
        items[itemIndex] = { ...items[itemIndex], ...overrides };
      }
    }
  }

  // Verify all existing options are valid, and if not remove them
  for (let i = items.length - 1; i >= 0; --i) {
    const item = items[i];
    if (item.isValid !== undefined && !item.isValid(args.propertyRecord, field) ) {
      items.splice(i, 1);
    }
  }

  return items;
}
