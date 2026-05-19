/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { FormatProps } from "@itwin/core-quantity";
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
import { useTranslation } from "../../../../useTranslation.js";
import { useTelemetryContext } from "../../../../hooks/UseTelemetryContext.js";

/** Properties of [[FormatTypeSelector]] component.
 * @alpha
 */
interface FormatTypeSelectorProps {
  type: FormatType;
  onChange: (value: FormatType) => void;
}

/** Component to select the format type.
 * @internal
 */
function FormatTypeSelector(props: FormatTypeSelectorProps) {
  const { type, onChange } = props;
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
      },
      {
        value: FormatType.Azimuth,
        label: translate("QuantityFormat:azimuth"),
      },
      {
        value: FormatType.Ratio,
        label: translate("QuantityFormat:ratio"),
      },
    ],
    [translate]
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

interface FormatTypeOptionProps {
  formatProps: FormatProps;
  onChange: (format: FormatProps) => void;
}

/** Component to set the Quantity Format type.
 * @internal
 */
export function FormatTypeOption(props: FormatTypeOptionProps) {
  const { formatProps, onChange } = props;
  const { onFeatureUsed } = useTelemetryContext();

  const handleFormatTypeChange = React.useCallback(
    (type: FormatType) => {
      onFeatureUsed("format-type-change");
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
          revolutionUnit = "Units.REVOLUTION"; // Warning: By default, BasicUnitsProvider does not contain this unit.
          break;
        case FormatType.Azimuth:
          revolutionUnit = "Units.REVOLUTION"; // Warning: By default, BasicUnitsProvider does not contain this unit.
          azimuthBaseUnit = "Units.ARC_DEG";
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
    [formatProps, onChange, onFeatureUsed]
  );

  const formatType = parseFormatType(formatProps.type, "format");

  return (
    <>
      <FormatTypeSelector
        type={formatType}
        onChange={handleFormatTypeChange}
      />
    </>
  );
}
