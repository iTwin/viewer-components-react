/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Button, DropdownMenu, MenuItem, Text } from "@itwin/itwinui-react";
import React from "react";
import type { GroupingCustomUI } from "../customUI/GroupingMappingCustomUI";
import "./GroupsAddButton.scss";
import { SvgCaretDownSmall } from "@itwin/itwinui-icons-react";

export interface GroupsDropdownMenuProps {
  disabled?: boolean;
  groupUIs: GroupingCustomUI[];
  onClickAddGroup: (type: string) => void;
}

export const GroupsAddButton = ({ disabled, groupUIs, onClickAddGroup }: GroupsDropdownMenuProps) => (
  <DropdownMenu
    className="gmw-custom-ui-dropdown"
    disabled={disabled}
    menuItems={() =>
      groupUIs.map((p, index) => (
        <MenuItem key={index} onClick={() => onClickAddGroup(p.name)} icon={p.icon} data-testid={`gmw-add-${index}`}>
          {p.displayLabel}
        </MenuItem>
      ))
    }
  >
    <Button data-testid="gmw-add-group-button" styleType="high-visibility" disabled={disabled} endIcon={<SvgCaretDownSmall />}>
      <Text>Add Group</Text>
    </Button>
  </DropdownMenu>
);
