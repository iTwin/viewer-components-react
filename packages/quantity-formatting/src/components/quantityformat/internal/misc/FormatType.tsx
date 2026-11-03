/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import { BentleyError, Logger } from "@itwin/core-bentley";
import type { FormatProps, UnitProps, UnitsProvider } from "@itwin/core-quantity";
import {
  DecimalPrecision,
  FormatType,
  FractionalPrecision,
  parseFormatType,
  RatioType,
  ScientificType,
} from "@itwin/core-quantity";
import type { SelectOption } from "@itwin/itwinui-react";
import { LabeledSelect } from "@itwin/itwinui-react";
import { QuantityFormattingLoggerCategory } from "../../../../QuantityFormatting.js";
import { useTranslation } from "../../../../useTranslation.js";

/** Properties of [[FormatTypeSelector]] component.
 * @alpha
 */
interface FormatTypeSelectorProps {
  type: FormatType;
  allowDirectionFormats: boolean;
  onChange: (value: FormatType) => void;
}

/** Component to select the format type.
 * @internal
 */
function FormatTypeSelector(props: FormatTypeSelectorProps) {
  const { type, allowDirectionFormats, onChange } = props;
  const { translate } = useTranslation();
  const formatOptions = React.useMemo<SelectOption<FormatType>[]>(
    () => [
      {
        value: FormatType.Decimal,
        label: translate("QuantityFormat:decimal"),
      },
      {
        value: FormatType.Scientific,
        label: translate("QuantityFormat:scientific"),
      },
      {
        value: FormatType.Station,
        label: translate("QuantityFormat:station"),
      },
      {
        value: FormatType.Fractional,
        label: translate("QuantityFormat:fractional"),
      },
      {
        value: FormatType.Bearing,
        label: translate("QuantityFormat:bearing"),
        disabled: !allowDirectionFormats,
      },
      {
        value: FormatType.Azimuth,
        label: translate("QuantityFormat:azimuth"),
        disabled: !allowDirectionFormats,
      },
      {
        value: FormatType.Ratio,
        label: translate("QuantityFormat:ratio"),
      },
    ],
    [translate, allowDirectionFormats]
  );



  return (
    <LabeledSelect
      displayStyle="inline"
      label={translate("QuantityFormat:labels.type")}
      options={formatOptions}
      onChange={(newValue: FormatType) => onChange(newValue)}
      size="small"
      value={type}
    />
  );
}

const handleUnitsWhenFormatTypeChange = (
  units: Array<{
    readonly name: string;
    readonly label?: string;
  }>,
  type: FormatType
) => {
  if (type === FormatType.Ratio) {
    // Only one display unit is allowed for Ratio format.
    if (units.length > 1) {
      return [units[0]];
    }
  }
  return units;
};

/**
 * Picks the revolution and azimuth base units for bearing/azimuth formats. They must belong to the same phenomenon as the
 * format's unit, otherwise the formatter cannot convert between them: for example, Units.HORIZONTAL_DIR_ARC_DEG cannot be
 * converted to Units.REVOLUTION.
 */
function getDirectionUnits(unit: UnitProps | undefined) {
  if (!unit?.isValid) return undefined;
  if (unit.phenomenon === "Units.HORIZONTAL_DIRECTION")
    return { revolutionUnit: "Units.HORIZONTAL_DIR_REVOLUTION", azimuthBaseUnit: "Units.HORIZONTAL_DIR_ARC_DEG" };
  if (unit.phenomenon === "Units.ANGLE")
    return { revolutionUnit: "Units.REVOLUTION", azimuthBaseUnit: "Units.ARC_DEG" };
  return undefined;
}

interface FormatTypeOptionProps {
  formatProps: FormatProps;
  unitsProvider: UnitsProvider;
  onChange: (format: FormatProps) => void;
}

/** Component to set the Quantity Format type.
 * @internal
 */
export function FormatTypeOption(props: FormatTypeOptionProps) {
  const { formatProps, unitsProvider, onChange } = props;
  const { translate } = useTranslation();
  const unitName = formatProps.composite?.units[0]?.name;
  const [lookup, setLookup] = React.useState<{
    unitName: string;
    unitsProvider: UnitsProvider;
    unit?: UnitProps;
    failed: boolean;
  }>();

  React.useEffect(() => {
    let disposed = false;
    if (!unitName) return;
    const loadUnit = async () => {
      try {
        const unit = await unitsProvider.findUnitByName(unitName);
        if (!disposed) setLookup({ unitName, unitsProvider, unit, failed: false });
      } catch (error) {
        if (disposed) return;
        Logger.logError(QuantityFormattingLoggerCategory, "Failed to look up the format unit", () => ({ unit: unitName, error: BentleyError.getErrorMessage(error) }));
        setLookup({ unitName, unitsProvider, failed: true });
      }
    };
    void loadUnit();
    return () => { disposed = true; };
  }, [unitName, unitsProvider]);

  const currentLookup = lookup?.unitName === unitName && lookup?.unitsProvider === unitsProvider ? lookup : undefined;
  const directionUnits = getDirectionUnits(currentLookup?.unit);

  const handleFormatTypeChange = React.useCallback(
    (type: FormatType) => {
      let precision: number | undefined;
      let stationOffsetSize: number | undefined;
      let scientificType: string | undefined;
      let azimuthBaseUnit: string | undefined;
      let azimuthBase: number | undefined;
      let revolutionUnit: string | undefined;
      let ratioType: string | undefined;
      switch (type) {
        case FormatType.Scientific:
          precision = DecimalPrecision.Six;
          scientificType = ScientificType.Normalized;
          break;
        case FormatType.Decimal:
          precision = DecimalPrecision.Four;
          break;
        case FormatType.Station:
          precision = DecimalPrecision.Two;
          stationOffsetSize = formatProps.composite?.units[0].name
            .toLocaleLowerCase()
            .endsWith("m")
            ? 3
            : 2;
          break;
        case FormatType.Fractional:
          precision = FractionalPrecision.Eight;
          break;
        case FormatType.Bearing:
          if (!directionUnits) return;
          ({ revolutionUnit } = directionUnits);
          break;
        case FormatType.Azimuth:
          if (!directionUnits) return;
          ({ revolutionUnit, azimuthBaseUnit } = directionUnits);
          azimuthBase = 0.0;
          break;
        case FormatType.Ratio:
          ratioType = RatioType.NToOne; // Default to N:1 ratio
          break;
      }
      const newFormatProps: FormatProps = {
        ...formatProps,
        composite: formatProps.composite
          ? {
              ...formatProps.composite,
              units: handleUnitsWhenFormatTypeChange(
                formatProps.composite.units,
                type
              ),
            }
          : undefined,
        type,
        precision,
        scientificType,
        stationOffsetSize,
        revolutionUnit,
        azimuthBaseUnit,
        azimuthBase,
        ratioType,
      };
      onChange(newFormatProps);
    },
    [formatProps, directionUnits, onChange]
  );

  const formatType = parseFormatType(formatProps.type, "format");

  return (
    <>
      <FormatTypeSelector
        type={formatType}
        allowDirectionFormats={directionUnits !== undefined}
        onChange={handleFormatTypeChange}
      />
      {currentLookup?.failed ? (
        <div role="alert">{translate("QuantityFormat:errors.unitLookup")}</div>
      ) : !directionUnits && (
        <div>{translate("QuantityFormat:labels.directionFormatsRequireAngles")}</div>
      )}
    </>
  );
}
