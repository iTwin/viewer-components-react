/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { ReactNode } from "react";
import { SelectOption, LabeledSelect } from "@itwin/itwinui-react";
import "./DropdownTile.scss";
import { NAME_REQUIREMENTS } from "../hooks/useValidator";
import SimpleReactValidator from "simple-react-validator";
import React from "react";
import {
  Select,
  Label
} from "@itwin/itwinui-react";

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
  deletionDisabled
}: DropdownTileProps) => {
  return (
    <div
      className="ec3-dropdown-tile-container"
      data-testid="horizontal-tile"
    >
      <div className="body">
        <div className="material-combo">

          <div className="dropdown-select-container">
            <div className="dropdown-select-combo-box">
              <Label htmlFor="combo-input" required>
                Material
              </Label>
              <Select
                disabled={disabled}
                options={stringColumnOptions}
                value={materialValue}
                onChange={(value) => { onMaterialChange(value); }}
              />
            </div>
          </div>
        </div>
        <div className="action-button" data-testid="tile-action-button" hidden={deletionDisabled} >
          {actionGroup}
        </div>

      </div>
    </div>
  );
};
