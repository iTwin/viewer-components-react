/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Fragment } from "react";
import { SvgMoreVertical } from "@itwin/itwinui-icons-react";
import { DropdownMenu, IconButton, MenuItem } from "@itwin/itwinui-react";
import { useNullValueSettingContext } from "../hooks/UseNullValuesSetting";
import { PropertyGridManager } from "../PropertyGridManager";

import type { PropsWithChildren, ReactNode } from "react";
import type { IPresentationPropertyDataProvider } from "@itwin/presentation-components";

/**
 * Props for single setting renderer.
 * @public
 */
export interface SettingProps {
  /** Data provider used by property grid. */
  dataProvider: IPresentationPropertyDataProvider;
  /** Callback that closes dropdown menu. */
  close: () => void;
}

/**
 * Props for configuring settings available in property grid header dropdown menu.
 * @public
 */
export interface SettingsProps {
  /** List of settings to render in dropdown menu. For consistent style recommend using `PropertyGridSetting` component. */
  settings?: Array<(props: SettingProps) => ReactNode>;
}

/**
 * Props for `PropertyGridSetting` component.
 * @public
 */
export interface PropertyGridSettingProps {
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
export function PropertyGridSetting({ id, onClick, title, children }: PropsWithChildren<PropertyGridSettingProps>) {
  return <MenuItem
    key={id}
    onClick={onClick}
    title={title}
  >
    {children}
  </MenuItem>;
}

/**
 * Props for `ShowHideNullValuesSetting`.
 * @public
 */
export interface ShowHideNullValuesSettingProps extends SettingProps {
  /** Specifies whether setting value should be persisted on change. */
  persist?: boolean;
}

/**
 * Renders `Show/Hide Empty Values` setting.
 * @public
 */
export function ShowHideNullValuesSetting({ close, persist }: ShowHideNullValuesSettingProps) {
  const { showNullValues, setShowNullValues } = useNullValueSettingContext();

  const label = showNullValues ? PropertyGridManager.translate("settings.hide-null.label") : PropertyGridManager.translate("settings.show-null.label");
  const description = showNullValues ? PropertyGridManager.translate("settings.hide-null.description") : PropertyGridManager.translate("settings.show-null.description");

  return (
    <PropertyGridSetting
      id="show-hide-null-values"
      title={description}
      onClick={() => {
        void setShowNullValues(!showNullValues, { persist });
        close();
      }}
    >
      {label}
    </PropertyGridSetting>
  );
}

/**
 * Props for `SettingsDropdownMenu`.
 * @internal
 */
export interface SettingsDropdownMenuProps extends SettingsProps {
  dataProvider: IPresentationPropertyDataProvider;
}

/**
 * Component that renders dropdown menu with provided settings.
 * @internal
 */
export function SettingsDropdownMenu({ settings, dataProvider }: SettingsDropdownMenuProps) {
  if (!settings || settings.length === 0) {
    return null;
  }

  return <SettingsDropdown settings={settings} dataProvider={dataProvider} />;
}

function SettingsDropdown({ settings, dataProvider }: SettingsDropdownMenuProps & {settings: Array<(props: SettingProps) => ReactNode>}) {
  const menuItems = (close: () => void) => settings.map((setting, index) => <Fragment key={index}>{setting({ dataProvider, close })}</Fragment>);

  return <DropdownMenu menuItems={menuItems}>
    <IconButton styleType="borderless" size="small" title={PropertyGridManager.translate("settings.label")}>
      <SvgMoreVertical />
    </IconButton>
  </DropdownMenu>;
}
