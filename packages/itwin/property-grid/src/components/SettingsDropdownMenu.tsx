/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useMemo } from "react";
import { SvgMoreVertical } from "@itwin/itwinui-icons-react";
import { DropdownMenu, IconButton, MenuItem } from "@itwin/itwinui-react";
import { PropertyGridManager } from "../PropertyGridManager";

import type { IPresentationPropertyDataProvider } from "@itwin/presentation-components";
import type { NullValueSetting } from "../hooks/UseNullValuesSetting";

/**
 * Type definition for settings provider.
 * @public
 */
export type SettingsProvider = (context: SettingContext) => SettingDefinition[];

/**
 * Context provided to `SettingsProvider`.
 * @public
 */
export interface SettingContext {
  /** Data provider used by property grid. */
  dataProvider: IPresentationPropertyDataProvider;
  /** State of `null` values setting. */
  nullValueSetting: NullValueSetting;
}

/**
 * Definition of single settings item that should be shown in dropdown menu.
 * @public
 */
export interface SettingDefinition {
  /** Unique id. */
  id: string;
  /** Label that is shown in dropdown menu. */
  label: string;
  /** Description that is shown while hovering over setting. */
  description?: string;
  /** Action that should be performed when setting is clicked. */
  action: () => Promise<void>;
}

/**
 * Props for configuring settings available in property grid header dropdown menu.
 * @public
 */
export interface SettingsProps {
  /** List of providers used to populate settings dropdown. */
  settingProviders?: SettingsProvider[];
}

/**
 * Props for `SettingsDropdownMenu`.
 * @internal
 */
export interface SettingsDropdownMenuProps extends SettingsProps {
  dataProvider: IPresentationPropertyDataProvider;
  showNullValues: boolean;
  setShowNullValues: (value: boolean) => Promise<void>;
}

/**
 * Component that renders dropdown menu with provided settings.
 * @internal
 */
export function SettingsDropdownMenu({ settingProviders, dataProvider, showNullValues, setShowNullValues }: SettingsDropdownMenuProps) {
  const itemDefinitions = useMemo(() => {
    return (settingProviders ?? []).flatMap((provider) => provider({ dataProvider, nullValueSetting: { showNullValues, setShowNullValues } }));
  }, [settingProviders, dataProvider, showNullValues, setShowNullValues]);

  if (itemDefinitions.length === 0) {
    return null;
  }

  const menuItems = (close: () => void) => itemDefinitions.map((definition) => (
    <MenuItem
      key={definition.id}
      onClick={() => {
        void definition.action();
        close();
      }}
      title={definition.description}
    >
      {definition.label}
    </MenuItem>
  ));

  return <DropdownMenu menuItems={menuItems}>
    <IconButton styleType="borderless" title={PropertyGridManager.translate("settings.label")}>
      <SvgMoreVertical />
    </IconButton>
  </DropdownMenu>;
}

/**
 * Creates provider for `Show/Hide Empty Values` setting.
 * @public
 */
export function createShowNullValuesSettingProvider(persist?: boolean) {
  return ({ nullValueSetting }: SettingContext) => {
    const { showNullValues, setShowNullValues } = nullValueSetting;
    const label = showNullValues ? PropertyGridManager.translate("settings.hide-null.label") : PropertyGridManager.translate("settings.show-null.label");
    const description = showNullValues ? PropertyGridManager.translate("settings.hide-null.description") : PropertyGridManager.translate("settings.show-null.description");
    return [{
      id: "show-hide-null-values",
      label,
      description,
      action: async () => setShowNullValues(!showNullValues, { persist }),
    }];
  };
}
