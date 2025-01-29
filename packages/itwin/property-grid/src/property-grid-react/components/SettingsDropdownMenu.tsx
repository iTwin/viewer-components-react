/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Fragment } from "react";
import { SvgMoreVertical } from "@itwin/itwinui-icons-react";
import { DropdownMenu, IconButton, MenuItem } from "@itwin/itwinui-react";
import { useNullValueSettingContext } from "../hooks/UseNullValuesSetting.js";
import { PropertyGridManager } from "../PropertyGridManager.js";

import type { PropsWithChildren, ReactNode } from "react";
import type { IPresentationPropertyDataProvider } from "@itwin/presentation-components";

/**
 * Props for single settings menu item renderer.
 * @public
 */
export interface SettingsMenuItemProps {
  /** Data provider used by property grid. */
  dataProvider: IPresentationPropertyDataProvider;
  /** Callback that closes dropdown menu. */
  close: () => void;
}

/**
 * Props for configuring settings available in property grid header dropdown menu.
 * @public
 */
export interface SettingsMenuProps {
  /** List of settings to render in dropdown menu. For consistent style recommend using `PropertyGridSettingsMenuItem` component. */
  settingsMenuItems?: Array<(props: SettingsMenuItemProps) => ReactNode>;
}

/**
 * Props for `PropertyGridSettingsMenuItem` component.
 * @public
 */
export interface PropertyGridSettingsMenuItemProps {
  /** Unique setting id. */
  id: string;
  /** Setting click event handler. */
  onClick: () => void;
  /** Setting title. */
  title?: string;
}

/**
 * Component for rendering single item in settings dropdown.
 * @public
 */
export function PropertyGridSettingsMenuItem({ id, onClick, title, children }: PropsWithChildren<PropertyGridSettingsMenuItemProps>) {
  return (
    <MenuItem key={id} onClick={onClick} title={title}>
      {children}
    </MenuItem>
  );
}

/**
 * Props for `ShowHideNullValuesSettingsMenuItem`.
 * @public
 */
export interface ShowHideNullValuesSettingsMenuItemProps extends SettingsMenuItemProps {
  /** Specifies whether setting value should be persisted on change. */
  persist?: boolean;
}

/**
 * Renders `Show/Hide Empty Values` setting.
 * @public
 */
export function ShowHideNullValuesSettingsMenuItem({ close, persist }: ShowHideNullValuesSettingsMenuItemProps) {
  const { showNullValues, setShowNullValues } = useNullValueSettingContext();

  const label = showNullValues ? PropertyGridManager.translate("settings.hide-null.label") : PropertyGridManager.translate("settings.show-null.label");
  const description = showNullValues
    ? PropertyGridManager.translate("settings.hide-null.description")
    : PropertyGridManager.translate("settings.show-null.description");

  return (
    <PropertyGridSettingsMenuItem
      id="show-hide-null-values"
      title={description}
      onClick={() => {
        void setShowNullValues(!showNullValues, { persist });
        close();
      }}
    >
      {label}
    </PropertyGridSettingsMenuItem>
  );
}

/**
 * Props for `SettingsDropdownMenu`.
 * @internal
 */
export interface SettingsDropdownMenuProps extends SettingsMenuProps {
  dataProvider: IPresentationPropertyDataProvider;
}

/**
 * Component that renders dropdown menu with provided settings.
 * @internal
 */
export function SettingsDropdownMenu({ settingsMenuItems, dataProvider }: SettingsDropdownMenuProps) {
  if (!settingsMenuItems || settingsMenuItems.length === 0) {
    return null;
  }

  const menuItems = (close: () => void) => settingsMenuItems.map((item, index) => <Fragment key={index}>{item({ dataProvider, close })}</Fragment>);

  return (
    <DropdownMenu menuItems={menuItems}>
      <IconButton styleType="borderless" title={PropertyGridManager.translate("settings.label")}>
        <SvgMoreVertical />
      </IconButton>
    </DropdownMenu>
  );
}
