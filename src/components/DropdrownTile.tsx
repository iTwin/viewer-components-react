/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { ReactNode } from "react";
import { SelectOption, LabeledSelect } from "@itwin/itwinui-react";
import "./DropdownTile.scss";
import { NAME_REQUIREMENTS } from "./hooks/useValidator";
import SimpleReactValidator from "simple-react-validator";

interface DropdownTileProps {
  stringColumnOptions: SelectOption<string>[];
  materialValue: string;
  onMaterialChange: (value: string) => void;
  actionGroup: ReactNode;
  validator: SimpleReactValidator;
}

export const DropdownTile = ({
  stringColumnOptions,
  materialValue,
  onMaterialChange,
  validator,
  actionGroup,
}: DropdownTileProps) => {
  return (
    <div
      className="rcw-dropdown-tile-container"
      data-testid="horizontal-tile"
    >
      <div className="body">
        <div className="material-combo">

          <LabeledSelect
            label="Material"
            id='material'
            required
            options={stringColumnOptions}
            value={materialValue}
            onChange={(value) => { onMaterialChange(value) }}
            message={validator.message(
              "materialValue",
              materialValue,
              NAME_REQUIREMENTS,
            )}
            status={
              validator.message(
                "materialValue",
                materialValue,
                NAME_REQUIREMENTS,
              )
                ? "negative"
                : undefined
            }
            onBlur={() => {
              validator.showMessageFor("materialValue");
            }}
          />
        </div>
        <div className="action-button" data-testid="tile-action-button">
          {actionGroup}
        </div>

      </div>
    </div>
  );
};
