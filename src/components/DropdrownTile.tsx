/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { ReactNode } from "react";
import React from "react";
import { Text, ComboBox, SelectOption, LabeledSelect } from "@itwin/itwinui-react";
import "./DropdownTile.scss";
import { CssProperties } from "@itwin/appui-layout-react";
import useValidator, { NAME_REQUIREMENTS } from "./hooks/useValidator";
import SimpleReactValidator from "simple-react-validator";

interface DropdownTileProps {
  stringColumnOptions: SelectOption<string>[];
  numericalColumnOptions: SelectOption<string>[];
  materialValue: string;
  quantityValue: string;
  onQuantityChange: (value: string) => void;
  onMaterialChange: (value: string) => void;
  actionGroup: ReactNode;
  validator: SimpleReactValidator;
  //title: string;
  //button: ReactNode;
  //subText?: string;
  //onClickTitle?: () => void;
  //titleTooltip?: string;
  //subtextToolTip?: string;
}

export const DropdownTile = ({
  //title,
  //subText,
  //onClickTitle,
  //titleTooltip,
  //subtextToolTip,
  //button,
  stringColumnOptions,
  numericalColumnOptions,
  materialValue,
  quantityValue,
  onQuantityChange,
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

        <div className="combo-field">
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


        <div className="combo-field-invisible"
        >
          <Text>
            Quantity
          </Text>
          <ComboBox
            options={numericalColumnOptions}
            value={quantityValue}
            onChange={onQuantityChange}

            inputProps={{
              id: "quantity-combo-input",
              placeholder: "Quantity",
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
