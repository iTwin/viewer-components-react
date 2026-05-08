/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./FormatPanel.scss";
import * as React from "react";
import { Format, FormatterSpec } from "@itwin/core-quantity";
import { Divider, Input, Label } from "@itwin/itwinui-react";
import { useTranslation } from "../../useTranslation.js";

import type { FormatDefinition, UnitProps } from "@itwin/core-quantity";
import type { UnitsProvider } from "@itwin/core-quantity";
/**
 * @beta
*/
interface FormatSampleProps {
  formatProps: FormatDefinition;
  unitsProvider: UnitsProvider;
  persistenceUnit?: UnitProps;
  initialMagnitude?: number;
}

/** Component to show the persistence value and formatted value for FormatDefinition.
 * Creates its own FormatterSpec internally based on formatProps and persistenceUnit.
 * @beta
 */
export function FormatSample(props: FormatSampleProps) {
  const { formatProps, unitsProvider, persistenceUnit, initialMagnitude } =
    props;
  const initialValue = initialMagnitude ?? 0;
  const [magnitude, setMagnitude] = React.useState(initialValue);
  const [sampleValue, setSampleValue] = React.useState(initialValue.toString());
  const [formatSpec, setFormatSpec] = React.useState<FormatterSpec | undefined>(
    undefined
  );
  const [formattedValue, setFormattedValue] = React.useState("");
  const { translate } = useTranslation();
  const inputId = React.useId();
  // Create FormatterSpec when formatProps or persistenceUnit changes
  React.useEffect(() => {
    let disposed = false;
    const createFormatterSpec = async () => {
      if (!persistenceUnit) {
        setFormatSpec(undefined);
        return;
      }

      try {
        const actualFormat = await Format.createFromJSON(
          "custom",
          unitsProvider,
          formatProps
        );
        const spec = await FormatterSpec.create(
          actualFormat.name,
          actualFormat,
          unitsProvider,
          persistenceUnit
        );
        if (disposed) return;
        setFormatSpec(spec);
      } catch {
        if (disposed) return;
        setFormatSpec(undefined);
      }
    };

    void createFormatterSpec();
    return () => {
      disposed = true;
    };
  }, [formatProps, unitsProvider, persistenceUnit]);

  React.useEffect(() => {
    const value = initialMagnitude ?? 0;
    setMagnitude(value);
    setSampleValue(value.toString());
  }, [initialMagnitude]);

  // Update formatted value when magnitude or formatSpec changes
  React.useEffect(() => {
    if (formatSpec) {
      setFormattedValue(formatSpec.applyFormatting(magnitude));
    } else {
      setFormattedValue("");
    }
  }, [magnitude, formatSpec]);

  const handleOnValueBlur = React.useCallback(() => {
    let newValue = Number.parseFloat(sampleValue);
    if (Number.isNaN(newValue)) newValue = 0;
    setMagnitude(newValue);
    setSampleValue(newValue.toString());
  }, [sampleValue]);

  const handleOnValueChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = event.target.value;
      setSampleValue(inputValue);
      if (inputValue === "") {
        setMagnitude(0);
      } else {
        const newValue = Number.parseFloat(inputValue);
        if (!Number.isNaN(newValue)) {
          setMagnitude(newValue);
        }
      }
    },
    []
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Pass through Ctrl/Cmd combos (clipboard: Ctrl+C/V/X/A, undo, etc.)
      if (e.ctrlKey || e.metaKey) return;

      const allowedControlKeys = [
        'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'Home', 'End'
      ];

      // Allow control keys, digits, decimal point, and leading minus sign
      if (!allowedControlKeys.includes(e.key) && !/^[0-9.-]$/.test(e.key)) {
        e.preventDefault();
        return;
      }

      // Only allow minus at position 0, and only if value doesn't already start with one
      if (e.key === "-" && ((e.currentTarget.selectionStart ?? 0) !== 0 || sampleValue.startsWith("-"))) {
        e.preventDefault();
        return;
      }

      // Handle Enter key - update magnitude and sampleValue
      if (e.key === "Enter") {
        let newValue = Number.parseFloat(sampleValue);
        if (Number.isNaN(newValue)) newValue = 0;
        setMagnitude(newValue);
        setSampleValue(newValue.toString());
        e.preventDefault();
      }
    },
    [sampleValue]
  );

  return (
    <div className="quantityFormat--formatSample-container">
        <Label
          className="quantityFormat--samplePreviewTitle"
          htmlFor={inputId}
        >
          {translate("QuantityFormat:labels.samplePreview")}
        </Label>
        <div className="quantityFormat--formatSample-previewRow">
          <div className="quantityFormat--formatSample-inputGroup">
            <Input
              id={inputId}
              className="quantityFormat--formatSample-input"
              value={sampleValue}
              onChange={handleOnValueChange}
              onKeyDown={handleKeyDown}
              onBlur={handleOnValueBlur}
              size="small"
            />
          </div>
          <Divider orientation="vertical" />
          <div className="quantityFormat--formatSample-resultSection">
            <Label className="quantityFormat--formattedValueLabel">
              {formattedValue}
            </Label>
          </div>
        </div>
    </div>
  );
}
