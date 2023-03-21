/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SvgAdd } from "@itwin/itwinui-icons-react";
import { Button, DropdownMenu, MenuItem, ProgressRadial } from "@itwin/itwinui-react";
import React from "react";
import type { GroupingCustomUI } from "./customUI/GroupingMappingCustomUI";

export interface GroupsDropdownMenuProps {
  isLoadingQuery: boolean;
  groupUIs: GroupingCustomUI[];
  onClickAddGroup: (type: string) => void;
}

export const GroupsAddButton = ({
  isLoadingQuery,
  groupUIs,
  onClickAddGroup,
}: GroupsDropdownMenuProps) => (
  <DropdownMenu
    className="gmw-custom-ui-dropdown"
    disabled={isLoadingQuery}
    menuItems={() =>
      groupUIs.map((p, index) => (
        <MenuItem
          key={index}
          onClick={() => onClickAddGroup(p.name)}
          icon={p.icon}
          data-testid={`gmw-add-${index}`}
        >
          {p.displayLabel}
        </MenuItem>
      ))
    }
  >
    <Button
      data-testid="gmw-add-group-button"
      startIcon={
        isLoadingQuery ? (
          <ProgressRadial size="small" indeterminate />
        ) : (
          <SvgAdd />
        )
      }
      styleType="high-visibility"
      disabled={isLoadingQuery}
    >
      {isLoadingQuery ? "Loading" : "Add Group"}
    </Button>
  </DropdownMenu>
);
