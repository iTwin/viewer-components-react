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
  required: boolean;
}

export const DropdownTile = ({ stringColumnOptions, materialValue, onMaterialChange, actionGroup, disabled, required }: DropdownTileProps) => {
  return (
    <div className="ec3w-dropdown-tile-container">
      <div className="ec3w-body">
        <div className="ec3w-material-combo">
          <LabeledSelect
            required={required}
            data-testid="ec3-dropdown-tile-select"
            label={"Material"}
            placeholder={"Select property containing Material names"}
            disabled={disabled}
            options={stringColumnOptions}
            value={materialValue}
            onChange={(value) => {
              onMaterialChange(value);
            }}
          />
        </div>
        <div className="ec3w-action-button" data-testid="ec3-tile-action-button">
          {actionGroup}
        </div>
      </div>
    </div>
  );
};
