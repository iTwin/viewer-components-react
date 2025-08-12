/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";
import {
  Format,
  type FormatProps,
  FormatterSpec,
  type UnitProps,
} from "@itwin/core-quantity";
import type { UnitsProvider } from "@itwin/core-quantity";
import { Divider, Input, Label } from "@itwin/itwinui-react";
import "./FormatPanel.scss";
import { useTranslation } from "../../useTranslation.js";

interface FormatSampleProps {
  formatProps: FormatProps;
  unitsProvider: UnitsProvider;
  persistenceUnit?: UnitProps;
  initialMagnitude?: number;
  hideLabels?: boolean;
}

/** Component to show the persistence value and formatted value for FormatProps.
 * Creates its own FormatterSpec internally based on formatProps and persistenceUnit.
 * @internal
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
  const { translate } = useTranslation();
  const inputId = React.useId();
  // Create FormatterSpec when formatProps or persistenceUnit changes
  React.useEffect(() => {
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
        setFormatSpec(spec);
      } catch {
        setFormatSpec(undefined);
      }
    };

    void createFormatterSpec();
  }, [formatProps, unitsProvider, persistenceUnit]);

  React.useEffect(() => {
    const value = initialMagnitude ?? 0;
    setMagnitude(value);
    setSampleValue(value.toString());
  }, [initialMagnitude]);

  const handleOnValueBlur = React.useCallback(() => {
    let newValue = Number.parseFloat(sampleValue);
    if (Number.isNaN(newValue)) newValue = 0;
    setMagnitude(newValue);
    setSampleValue(newValue.toString());
  }, [sampleValue]);

  const handleOnValueChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSampleValue(event.target.value);
    },
    []
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
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

  const activePersistenceUnitLabel = formatSpec
    ? formatSpec.persistenceUnit.label
    : persistenceUnit?.label ?? "";
  const formattedValue = formatSpec
    ? formatSpec.applyFormatting(magnitude)
    : "";

  return (
    <div className="quantityFormat--formatSample-container">
      <div className="quantityFormat--formatSample-box">
        <Label
          className="quantityFormat--samplePreviewTitle"
          htmlFor={inputId}
        >
          {translate("QuantityFormat.labels.samplePreview")}
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
            <Label className="quantityFormat--persistenceUnitLabel">
              {activePersistenceUnitLabel}
            </Label>
          </div>
          <Divider orientation="vertical" />
          <Label className="quantityFormat--formattedValueLabel">
            {formattedValue}
          </Label>
        </div>
      </div>
    </div>
  );
}
