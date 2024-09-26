/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Fragment, useState } from "react";
import { ContextMenuItem as CoreContextMenuItem, GlobalContextMenu } from "@itwin/core-react";
import { FavoritePropertiesScope, Presentation } from "@itwin/presentation-frontend";
import { copyToClipboard } from "../api/WebUtilities";
import { PropertyGridManager } from "../PropertyGridManager";
import { useTelemetryContext } from "./UseTelemetryContext";

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
  return (
    <CoreContextMenuItem key={id} onSelect={onSelect} title={title}>
      {children}
    </CoreContextMenuItem>
  );
}

/**
 * Props for default context menu items.
 * @public
 */
export interface DefaultContextMenuItemProps extends ContextMenuItemProps {
  /**
   * Callback that is invoked when context menu item is clicked. `defaultAction` argument passed to
   * this callback can be invoked to persist default behavior or omitted to completely override it.
   */
  onSelect?: (defaultAction: () => Promise<void>) => Promise<void>;
}

/**
 * Props for `Add/Remove` favorite properties context menu items.
 * @public
 */
export interface FavoritePropertiesContextMenuItemProps extends DefaultContextMenuItemProps {
  /** Scope in which favorite property should be stored. Defaults to `FavoritePropertiesScope.IModel`. */
  scope?: FavoritePropertiesScope;
}

/**
 * Renders `Add to Favorite` context menu item if property field is not favorite. Otherwise renders nothing.
 * @public
 */
export function AddFavoritePropertyContextMenuItem({ field, imodel, scope, onSelect }: FavoritePropertiesContextMenuItemProps) {
  const currentScope = scope ?? FavoritePropertiesScope.IModel;
  if (!field || Presentation.favoriteProperties.has(field, imodel, currentScope)) {
    return null;
  }

  const defaultAction = async () => Presentation.favoriteProperties.add(field, imodel, currentScope);

  return (
    <PropertyGridContextMenuItem
      id="add-favorite"
      onSelect={async () => {
        if (onSelect) {
          await onSelect(defaultAction);
          return;
        }

        await defaultAction();
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
export function RemoveFavoritePropertyContextMenuItem({ field, imodel, scope, onSelect }: FavoritePropertiesContextMenuItemProps) {
  const currentScope = scope ?? FavoritePropertiesScope.IModel;
  if (!field || !Presentation.favoriteProperties.has(field, imodel, currentScope)) {
    return null;
  }

  const defaultAction = async () => Presentation.favoriteProperties.remove(field, imodel, currentScope);

  return (
    <PropertyGridContextMenuItem
      id="remove-favorite"
      onSelect={async () => {
        if (onSelect) {
          await onSelect(defaultAction);
          return;
        }

        await defaultAction();
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
export function CopyPropertyTextContextMenuItem({ record, onSelect }: DefaultContextMenuItemProps) {
  const defaultAction = async () => {
    record.description && copyToClipboard(record.description);
  };

  return (
    <PropertyGridContextMenuItem
      id="copy-text"
      onSelect={async () => {
        if (onSelect) {
          await onSelect(defaultAction);
          return;
        }

        await defaultAction();
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
  position: { x: number; y: number };
  menuItems: ReactNode[];
}

/**
 * Custom hook for rendering property grid context menu.
 * @internal
 */
export function useContextMenu({ dataProvider, imodel, contextMenuItems }: UseContentMenuProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuDefinition>();
  const { onFeatureUsed } = useTelemetryContext();

  const onPropertyContextMenu = async (args: PropertyGridContextMenuArgs) => {
    args.event.persist();
    if (!contextMenuItems || contextMenuItems.length === 0) {
      return;
    }

    const field = await dataProvider.getFieldByPropertyDescription(args.propertyRecord.property);
    const items = contextMenuItems.map((item, index) => <Fragment key={index}>{item({ imodel, dataProvider, record: args.propertyRecord, field })}</Fragment>);

    onFeatureUsed("context-menu");
    setContextMenu({
      position: { x: args.event.clientX, y: args.event.clientY },
      menuItems: items,
    });
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
