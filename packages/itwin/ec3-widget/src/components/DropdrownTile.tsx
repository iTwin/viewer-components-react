/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { ReactNode } from "react";
import type { SelectOption } from "@itwin/itwinui-react";
import { LabeledSelect } from "@itwin/itwinui-react";
import "./DropdownTile.scss";
import React from "react";

interface DropdownTileProps {
  stringColumnOptions: SelectOption<string>[];
  materialValue: string;
  onMaterialChange: (value: string) => void;
  actionGroup: ReactNode;
  disabled: boolean;
  deletionDisabled: boolean;
}

export const DropdownTile = ({
  stringColumnOptions,
  materialValue,
  onMaterialChange,
  actionGroup,
  disabled,
  deletionDisabled,
}: DropdownTileProps) => {
  return (
    <div className="ec3w-dropdown-tile-container">
      <div className="ec3w-body">
        <div className="ec3w-material-combo">
          <div className="ec3w-dropdown-select-container">
            <div className="ec3w-dropdown-select-combo-box">
              <LabeledSelect
                label={"Material"}
                disabled={disabled}
                options={stringColumnOptions}
                value={materialValue}
                onChange={(value) => { onMaterialChange(value); }}
              />
            </div>
          </div>
        </div>
        <div className="ec3w-action-button" data-testid="tile-action-button" hidden={deletionDisabled}>
          {actionGroup}
        </div>
      </div>
    </div>
  );
};
