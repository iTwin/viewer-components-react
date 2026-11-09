/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { IconButton, Tooltip } from "@mui/material";
import sunIcon from "@stratakit/icons/sun.svg";
import { Icon } from "@stratakit/mui";
import { DropdownMenu } from "@stratakit/structures";

import type { ColorSchemePreference } from "../UseColorScheme";

export function ColorThemeDropdown(props: { colorScheme: ColorSchemePreference; setColorScheme: (value: ColorSchemePreference) => void }) {
  return (
    <DropdownMenu.Provider>
      <Tooltip title="Change color scheme">
        <DropdownMenu.Button
          style={{ position: "fixed", top: "6px", right: "8px", zIndex: 9999 }}
          render={
            <IconButton size="small" aria-label="Change color scheme">
              <Icon href={sunIcon} />
            </IconButton>
          }
        />
      </Tooltip>
      <DropdownMenu.Content>
        {(["system", "light", "dark"] as const).map((value) => (
          <DropdownMenu.Item
            key={value}
            role="menuitemradio"
            aria-checked={props.colorScheme === value}
            style={
              props.colorScheme === value
                ? { backgroundColor: "var(--stratakit-color-bg-accent-base)", color: "var(--stratakit-color-text-neutral-emphasis)" }
                : undefined
            }
            label={value}
            onClick={() => props.setColorScheme(value)}
          />
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Provider>
  );
}
