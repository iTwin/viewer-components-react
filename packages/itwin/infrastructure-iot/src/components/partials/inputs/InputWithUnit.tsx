/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import React, { useEffect, useState } from "react";

import { Input, Select, useTheme } from "@itwin/itwinui-react";
import type { SelectOption } from "@itwin/itwinui-react/esm/core/Select/Select";

import { debounce as _debounce, isFinite as _isFinite } from "lodash";

import styles from "./InputWithUnit.module.scss";

export function InputWithUnit(props: {
  inputValue: number;
  unitValue?: string;
  unitOptions?: SelectOption<string>[];
  label?: string;
  onChange: (newValue: {value: number, unit?: string}) => void;
}) {

  // This is needed to iTwin React component to respect system-wide light/dark mode
  useTheme("os");

  // Store local copies of input/unit values
  const [inputValue, setInputValue] = useState<number>(props.inputValue);
  useEffect(() => {
    setInputValue(props.inputValue);
  }, [props.inputValue]);
  const [unitValue, setUnitValue] = useState<string | undefined>(props.unitValue);
  useEffect(() => {
    setUnitValue(props.unitValue);
  }, [props.unitValue]);

  // Fire off event on input change
  const onInputChange = _debounce((newInputValue: any): void => {
    if (newInputValue) {
      const newValue = parseFloat(newInputValue);
      if (_isFinite(newValue)) {
        props.onChange({value: newValue, unit: unitValue});
      }
    }
  }, 1000);

  // Fire off event on unit select change
  const onUnitChange = (newUnitValue: string) => {
    if (newUnitValue !== unitValue) {
      setUnitValue(newUnitValue);
      props.onChange({value: inputValue, unit: newUnitValue});
    }
  };

  return (
    <div className={styles["input-container"]}>
      <Input
        size="small"
        type="number"
        value={inputValue}
        onChange={(event: any) => {
          setInputValue(event.target.value);
          onInputChange(event.target.value);
        }}/>
      {!!props.unitOptions?.length && (
        <Select
          className={styles["select-input"]}
          size="small"
          options={props.unitOptions}
          value={unitValue}
          onChange={(newValue: string) => onUnitChange(newValue)}/>
      )}
      {!!props.label && (
        <span>{props.label}</span>
      )}
    </div>
  );
}
