/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";
import type { FormatDefinition } from "@itwin/core-quantity";
import { Input, Label } from "@itwin/itwinui-react";
import { useTranslation } from "../../../useTranslation.js";

/** Properties of [[StationBaseFactor]] component.
 * @internal
 */
export interface StationBaseFactorProps {
  formatProps: FormatDefinition;
  onChange: (format: FormatDefinition) => void;
}

/** Component to show/edit Station Format Base Factor.
 * The base factor is used to scale station values for display purposes.
 * Only accepts integer values (no decimal points).
 * @internal
 */
export function StationBaseFactor(props: StationBaseFactorProps) {
  const { formatProps, onChange } = props;
  const { translate } = useTranslation();
  const stationBaseFactorInputId = React.useId();

  const currentValue = (formatProps as any).stationBaseFactor ?? 1;

  const [inputValue, setInputValue] = React.useState(currentValue.toString());

  React.useEffect(() => {
    setInputValue(currentValue.toString());
  }, [currentValue]);

  const handleValueChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      // Only allow digits
      if (/^\d*$/.test(value)) {
        setInputValue(value);
      }
    },
    []
  );
  const handleValueBlur = React.useCallback(() => {
    let newValue = Number.parseInt(inputValue, 10);
    if (Number.isNaN(newValue) || newValue < 1) {
      newValue = 1; // Default to 1 for invalid values
    }

    setInputValue(newValue.toString());

    if (newValue !== currentValue) {
      const newFormatProps = { ...formatProps, stationBaseFactor: newValue };
      onChange(newFormatProps);
    }
  }, [inputValue, currentValue, formatProps, onChange]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      // Allow control keys (Backspace, Delete, Tab, Escape, Enter, Arrow keys)
      const allowedKeys = [
        'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'Home', 'End'
      ];

      // Allow control keys and number keys (0-9)
      if (!allowedKeys.includes(event.key) && !/^[0-9]$/.test(event.key)) {
        event.preventDefault();
      }

      //
      if (event.key === "Enter") {
        handleValueBlur();
        event.preventDefault();
        return;
      }


    },
    [handleValueBlur]
  );


  return (
    <div className="quantityFormat--formatInlineRow">
      <Label displayStyle="inline" htmlFor={stationBaseFactorInputId}>
        {translate("QuantityFormat:labels.stationBaseFactorLabel")}
      </Label>
      <Input
        id={stationBaseFactorInputId}
        value={inputValue}
        onChange={handleValueChange}
        onKeyDown={handleKeyDown}
        onBlur={handleValueBlur}
        size="small"
        style={{ width: "80px" }}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
      />
    </div>
  );
}
