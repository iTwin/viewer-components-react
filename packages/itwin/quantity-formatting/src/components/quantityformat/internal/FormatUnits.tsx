/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import "../FormatPanel.scss";
import * as React from "react";
import { SvgHelpCircularHollow } from "@itwin/itwinui-icons-react";
import { IconButton, Input, Label, Select } from "@itwin/itwinui-react";
import { useTranslation } from "../../../useTranslation.js";
import { getUnitName } from "./misc/UnitDescr.js";

import type {
  FormatDefinition,
  UnitProps,
  UnitsProvider,
} from "@itwin/core-quantity";
import type { SelectOption } from "@itwin/itwinui-react";
async function getUnitConversionData(
  possibleUnits: UnitProps[],
  toUnit: UnitProps,
  unitsProvider: UnitsProvider
) {
  const unitConversionEntries = possibleUnits.map(async (unit) => {
    const conversion = await unitsProvider.getConversion(unit, toUnit);
    return { conversion, unitProps: unit };
  });
  return unitConversionEntries;
}

async function getPossibleUnits(
  parentUnit: UnitProps,
  unitsProvider: UnitsProvider,
  ensureCompatibleComposite: boolean
) {
  const phenomenon = parentUnit.phenomenon;
  const possibleUnits = await unitsProvider.getUnitsByFamily(phenomenon);
  if (!ensureCompatibleComposite) return possibleUnits;

  const conversionPromises = await getUnitConversionData(
    possibleUnits,
    parentUnit,
    unitsProvider
  );
  const conversionEntries = await Promise.all(conversionPromises);
  // sort the entries so the best potential sub unit will be the first one in the array
  return conversionEntries
    .filter(
      (entry) =>
        entry.unitProps.system === parentUnit.system &&
        entry.conversion.factor < 1
    )
    .sort((a, b) => b.conversion.factor - a.conversion.factor)
    .map((value) => value.unitProps);
}

/** Properties of [[FormatUnits]] component.
 * @internal
 */
export interface FormatUnitsProps {
  initialFormat: FormatDefinition;
  persistenceUnit?: UnitProps;
  unitsProvider: UnitsProvider;
  onUnitsChange: (format: FormatDefinition) => void;
}
function UnitDescr(props: {
  name: string;
  parentUnitName?: string;
  label: string;
  index: number;
  unitsProvider: UnitsProvider;
  readonly?: boolean;
  onUnitChange: (value: string, index: number) => void;
  onLabelChange: (value: string, index: number) => void;
}) {
  const {
    name,
    label,
    parentUnitName,
    index,
    onUnitChange,
    onLabelChange,
    readonly,
    unitsProvider,
  } = props;
  const { translate } = useTranslation();

  const [unitOptions, setUnitOptions] = React.useState<SelectOption<string>[]>([
    { value: `${name}:${label}`, label: getUnitName(name) },
  ]);
  const [currentUnit, setCurrentUnit] = React.useState({ name, label });

  const unitSelectorId = React.useId();
  const labelInputId = React.useId();


  React.useEffect(() => {
    let disposed = false;
    const fetchAllowableUnitSelections = async () => {
      try {
        const currentUnitProps = await unitsProvider.findUnitByName(name);
        const parentUnit = await unitsProvider.findUnitByName(
          parentUnitName ? parentUnitName : name
        );

        if (parentUnit && currentUnitProps) {
          let potentialSubUnit: UnitProps | undefined;
          const potentialUnits = await getPossibleUnits(
            parentUnit,
            unitsProvider,
            index !== 0
          );

          if (index < 3) {
            const potentialSubUnits = await getPossibleUnits(
              currentUnitProps,
              unitsProvider,
              true
            );
            if (potentialSubUnits.length)
              potentialSubUnit = potentialSubUnits[0];
          }

          const options =
            potentialUnits.length > 0
              ? potentialUnits
                  .map((unitValue) => {
                    return {
                      value: `${unitValue.name}:${unitValue.label}`,
                      label: getUnitName(unitValue.name),
                    };
                  })
                  .sort((a, b) => a.label.localeCompare(b.label))
              : [
                  {
                    value: `${currentUnitProps.name}:${currentUnitProps.label}`,
                    label: getUnitName(name),
                  },
                ];

          if (potentialSubUnit) {
            // construct an entry that will provide the name and label of the unit to add
            options.push({
              value: `ADDSUBUNIT:${potentialSubUnit.name}:${potentialSubUnit.label}`,
              label: translate("QuantityFormat:labels.addSubUnit"),
            });
          }

          if (index !== 0) {
            options.push({
              value: "REMOVEUNIT",
              label: translate("QuantityFormat:labels.removeUnit"),
            });
          }

          if (disposed) return;
          setUnitOptions(options);
          setCurrentUnit(currentUnitProps);
        }
      } catch (error) {
        // Fallback to current unit if there's an error
        console.warn("Failed to load unit options:", error);
        if (disposed) return;
        setUnitOptions([
          { value: `${name}:${label}`, label: getUnitName(name) },
        ]);
      }
    }

    void fetchAllowableUnitSelections();

    return () => {
      disposed = true;
    };
  }, [index, label, name, parentUnitName, translate, unitsProvider]);

  const handleOnLabelChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();
      onLabelChange(e.target.value, index);
    },
    [index, onLabelChange]
  );

  return (
    <div className="quantityFormat--formatInlineRow">
      <Select
        id={unitSelectorId}
        options={unitOptions}
        data-testid={`unit-${currentUnit.name}`}
        value={`${currentUnit.name}:${currentUnit.label}`}
        onChange={(newValue) => onUnitChange(newValue, index)}
        disabled={readonly}
        size="small"
        className="quantityFormat--unitSelect"
      />
      <Input
        id={labelInputId}
        data-testid={`unit-label-${currentUnit.name}`}
        value={label}
        onChange={handleOnLabelChange}
        size="small"
        disabled={readonly}
        className="quantityFormat--unitInput"
      />
    </div>
  );
}

/** Component to show/edit Units used for Quantity Formatting.
 * @internal
 */
export function FormatUnits(props: FormatUnitsProps) {
  const { initialFormat, persistenceUnit, unitsProvider, onUnitsChange } =
    props;
  const { translate } = useTranslation();
  const initialFormatRef = React.useRef<FormatDefinition>(initialFormat);
  const [formatProps, setFormatProps] = React.useState(initialFormat);
  const compositeSpacerSelectorId = React.useId();

  React.useEffect(() => {
    if (initialFormatRef.current !== initialFormat) {
      initialFormatRef.current = initialFormat;
      setFormatProps(initialFormat);
    }
  }, [initialFormat]);

  const handleSetFormatProps = React.useCallback(
    (newProps: FormatDefinition) => {
      setFormatProps(newProps);
      onUnitsChange(newProps);
    },
    [onUnitsChange]
  );

  const handleUnitLabelChange = React.useCallback(
    (newLabel: string, index: number) => {
      if (
        formatProps.composite &&
        formatProps.composite.units.length > index &&
        index >= 0
      ) {
        const units = formatProps.composite.units.map((entry, ndx) => {
          if (index === ndx) return { name: entry.name, label: newLabel };
          else return entry;
        });

        const composite = { ...formatProps.composite, units };
        const newFormatProps = { ...formatProps, composite };
        handleSetFormatProps(newFormatProps);
      }
    },
    [formatProps, handleSetFormatProps]
  );

  const handleUnitChange = React.useCallback(
    (newUnit: string, index: number) => {
      const unitParts = newUnit.split(/:/);
      if (unitParts[0] === "REMOVEUNIT") {
        if (formatProps.composite && formatProps.composite.units.length > 1) {
          const units = [...formatProps.composite.units];
          units.pop();
          const composite = { ...formatProps.composite, units };
          const newFormatProps = { ...formatProps, composite };
          handleSetFormatProps(newFormatProps);
        }
      } else if (unitParts[0] === "ADDSUBUNIT") {
        const units =
          formatProps.composite && formatProps.composite.units.length
            ? [
                ...formatProps.composite.units,
                { name: unitParts[1], label: unitParts[2] },
              ]
            : [{ name: unitParts[1], label: unitParts[2] }];
        const composite = { ...formatProps.composite, units };
        const newFormatProps = { ...formatProps, composite };
        handleSetFormatProps(newFormatProps);
      } else {
        if (
          formatProps.composite &&
          formatProps.composite.units.length > index &&
          index >= 0
        ) {
          const units = formatProps.composite.units.map((entry, ndx) => {
            if (index === ndx)
              return { name: unitParts[0], label: unitParts[1] };
            else return entry;
          });
          const composite = { ...formatProps.composite, units };
          const newFormatProps = { ...formatProps, composite };
          handleSetFormatProps(newFormatProps);
        } else if (!formatProps.composite) {
          const composite = {
            units: [{ name: unitParts[0], label: unitParts[1] }],
          };
          const newFormatProps = { ...formatProps, composite };
          handleSetFormatProps(newFormatProps);
        }
      }
    },
    [formatProps, handleSetFormatProps]
  );

  const handleOnSpacerChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (formatProps.composite) {
        const spacerValue = e.target.value.length ? e.target.value[0] : ""; // spacer can only be empty or a single character
        const composite = { ...formatProps.composite, spacer: spacerValue };
        handleSetFormatProps({ ...formatProps, composite });
      }
    },
    [formatProps, handleSetFormatProps]
  );

  return (
    <>
      {formatProps.composite?.units
        ? formatProps.composite.units.map((value, index) => (
            <UnitDescr
              key={value.name}
              name={value.name}
              label={value.label ?? ""}
              parentUnitName={
                index > 0
                  ? formatProps.composite!.units[index - 1].name
                  : undefined
              }
              unitsProvider={unitsProvider}
              index={index}
              onUnitChange={handleUnitChange}
              onLabelChange={handleUnitLabelChange}
              readonly={index < formatProps.composite!.units.length - 1}
            />
          ))
        : persistenceUnit && (
            <UnitDescr
              key={persistenceUnit.name}
              name={persistenceUnit.name}
              label={persistenceUnit.label}
              unitsProvider={unitsProvider}
              index={0}
              onUnitChange={handleUnitChange}
              onLabelChange={handleUnitLabelChange}
            />
          )}

      {formatProps.composite?.units &&
        formatProps.composite.units.length > 1 && (
          <div className="quantityFormat--formatInlineRow">
            <Label displayStyle="inline" htmlFor={compositeSpacerSelectorId}>
              {translate("QuantityFormat:labels.compositeSpacer")}
              <IconButton
                className="quantityFormat--formatHelpTooltip"
                size="small"
                styleType="borderless"
                label={translate(
                  "QuantityFormat:labels.compositeSpacerDescription"
                )}
              >
                <SvgHelpCircularHollow />
              </IconButton>
            </Label>
            <Input
              id={compositeSpacerSelectorId}
              value={formatProps.composite.spacer ?? ""}
              onChange={handleOnSpacerChange}
              size="small"
              className="quantityFormat--unitInput"
            />
          </div>
        )}
    </>
  );
}
