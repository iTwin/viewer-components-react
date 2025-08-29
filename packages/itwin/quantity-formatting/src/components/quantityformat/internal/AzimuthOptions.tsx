/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { FormatProps, UnitsProvider } from "@itwin/core-quantity";
import React from "react";
import { useTranslation } from "../../../useTranslation.js";
import { SvgHelpCircularHollow } from "@itwin/itwinui-icons-react";
import {
  Checkbox,
  IconButton,
  Input,
  Label,
  LabeledSelect,
} from "@itwin/itwinui-react";
import type { SelectOption } from "@itwin/itwinui-react";
import { getUnitName } from "./misc/UnitDescr.js";

/**
 * Non-exported component for selecting azimuth base unit.
 */
function AzimuthBaseUnitSelector(props: {
  currentUnit: string;
  unitsProvider: UnitsProvider;
  onChange: (unitName: string) => void;
}) {
  const { currentUnit, unitsProvider, onChange } = props;
  const { translate } = useTranslation();
  const [unitOptions, setUnitOptions] = React.useState<SelectOption<string>[]>([
    { value: currentUnit, label: currentUnit },
  ]);

  React.useEffect(() => {
    let disposed = false;
    const loadUnitOptions = async () => {
      try {
        // Find the current unit to get its phenomenon (family)
        const baseUnit = await unitsProvider.findUnitByName(currentUnit);
        if (baseUnit) {
          // Get all units in the same family
          const familyUnits = await unitsProvider.getUnitsByFamily(
            baseUnit.phenomenon
          );
          const options = familyUnits
            .map((unit) => ({
              value: unit.name,
              label: getUnitName(unit.name),
            }))
            .sort((a, b) => a.label.localeCompare(b.label));

          if (disposed) return;
          setUnitOptions(options);
        }
      } catch (error) {
        // Fallback to current unit if there's an error
        console.warn("Failed to load unit family:", error);
        setUnitOptions([{ value: currentUnit, label: currentUnit }]);
      }
    }

    void loadUnitOptions();
    return () => {
      disposed = true;
    };
  }, [currentUnit, unitsProvider]);

  return (
    <div className="quantityFormat--formatInlineRow">
      <LabeledSelect
        label={
          <>
            {translate("QuantityFormat:labels.azimuthBaseUnit")}
            <IconButton
              size="small"
              styleType="borderless"
              label={translate("QuantityFormat:azimuthType.baseUnitTooltip")}
            >
              <SvgHelpCircularHollow />
            </IconButton>
          </>
        }
        value={currentUnit}
        options={unitOptions}
        onChange={(value: string) => onChange(value)}
        size="small"
        displayStyle="inline"
      />
    </div>
  );
}

/**
 * Component used to customize Azimuth options of a Format ().
 * @alpha
 */
export function AzimuthOptions(props: {
  formatProps: FormatProps;
  onChange: (format: FormatProps) => void;
  unitsProvider: UnitsProvider;
}) {
  const { formatProps, onChange, unitsProvider } = props;
  const { translate } = useTranslation();

  const baseInputId = React.useId();
  const ccwCheckboxId = React.useId();

  const handleAzimuthBaseChange = React.useCallback(
    (value: number) => {
      const newFormatProps = { ...formatProps, azimuthBase: value };
      onChange(newFormatProps);
    },
    [formatProps, onChange]
  );


  /** Disable commas and letters */
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const isLetter = /^[a-zA-Z]$/.test(event.key);
    if (event.key === "," || isLetter) {
      event.preventDefault();
    }
  };

  const handleInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const numValue = Number(e.target.value);
      if (isNaN(numValue)) {
        e.preventDefault();
        return;
      }
      handleAzimuthBaseChange(numValue);
    },
    [handleAzimuthBaseChange]
  );

  return (
    <>
      <div className="quantityFormat--formatInlineRow">
        <Label htmlFor={ccwCheckboxId} displayStyle="inline">
          {translate("QuantityFormat:labels.azimuthCounterClockwise")}
        </Label>
        <IconButton
          size="small"
          styleType="borderless"
          label={translate("QuantityFormat:azimuthType.ccwFlagTooltip")}
        >
          <SvgHelpCircularHollow />
        </IconButton>
        <Checkbox
          id={ccwCheckboxId}
          checked={formatProps.azimuthCounterClockwise ?? false}
          onChange={(event) => onChange({ ...formatProps, azimuthCounterClockwise: event.target.checked })}
        />
      </div>

      <AzimuthBaseUnitSelector
        currentUnit={formatProps.azimuthBaseUnit ?? "Units.ARC_DEG"}
        unitsProvider={unitsProvider}
        onChange={(value) => onChange({ ...formatProps, azimuthBaseUnit: value })}
      />
      <div className="quantityFormat--formatInlineRow">
        <Label htmlFor={baseInputId} displayStyle="inline">
          {translate("QuantityFormat:labels.azimuthBase")}
        </Label>
        <IconButton
          size="small"
          styleType="borderless"
          label={translate("QuantityFormat:azimuthType.baseTooltip")}
        >
          <SvgHelpCircularHollow />
        </IconButton>
        <Input
          id={baseInputId}
          type="number"
          value={formatProps.azimuthBase?.toString() ?? "0"}
          onKeyDown={onKeyDown}
          onChange={handleInputChange}
          size="small"
        />
      </div>
    </>
  );
}
