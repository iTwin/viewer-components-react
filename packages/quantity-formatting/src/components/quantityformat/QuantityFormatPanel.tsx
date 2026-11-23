/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./FormatPanel.scss";
import * as React from "react";
import { Button, Flex } from "@itwin/itwinui-react";
import { useTranslation } from "../../useTranslation.js";
import { FormatPanel } from "./FormatPanel.js";
import { FormatSample } from "./FormatSample.js";
import { useUnitsProvider } from "./internal/useUnitsProvider.js";
import { BentleyError, Logger } from "@itwin/core-bentley";
import { QuantityFormattingLoggerCategory } from "../../QuantityFormatting.js";
import { Format, FormatterSpec, FormatType } from "@itwin/core-quantity";

import type { UnitProps, FormatDefinition, UnitsProvider } from "@itwin/core-quantity";
/** Properties of [[QuantityFormatPanel]] component.
 * @beta
 */
export interface QuantityFormatPanelProps {
  formatDefinition: FormatDefinition;
  /** Units used to look up and convert units. Defaults to `IModelApp.quantityFormatter.unitsProvider`. */
  unitsProvider?: UnitsProvider;
  /** Called with the edited definition when the user selects Apply. Edits are discarded when `formatDefinition` changes. */
  onFormatChange: (formatProps: FormatDefinition) => void;
  initialMagnitude?: number;
  showSample?: boolean;
}

/** Quantity Format Panel  that uses the new FormatPanel structure
 * @beta
 */
export function QuantityFormatPanel(props: QuantityFormatPanelProps) {
  const {
    formatDefinition,
    onFormatChange,
    showSample = true,
  } = props;
  const unitsProvider = useUnitsProvider(props.unitsProvider);

  const { translate } = useTranslation();

  // Clone the formatDefinition to work with internally
  const [clonedFormatDefinition, setClonedFormatDefinition] = React.useState<FormatDefinition>(() =>
  ({ ...formatDefinition })
  );

  const [saveEnabled, setSaveEnabled] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState(false);
  const saveRequest = React.useRef(0);

  React.useEffect(() => {
    setSaveError(false);
    setIsSaving(false);
    return () => { saveRequest.current++; };
  }, [clonedFormatDefinition, unitsProvider]);

  const [persistenceUnit, setPersistenceUnit] = React.useState<
    UnitProps | undefined
  >(undefined);

  // Update the cloned format definition when the prop changes
  React.useEffect(() => {
    setClonedFormatDefinition({ ...formatDefinition });
    setSaveEnabled(false);
  }, [formatDefinition]);

  // Generate persistenceUnit from first composite unit. Keyed on the unit name so unrelated edits don't reload it.
  const firstUnitName = clonedFormatDefinition.composite?.units[0]?.name;
  React.useEffect(() => {
    let disposed = false;
    const loadPersistenceUnit = async () => {
      if (!firstUnitName) {
        setPersistenceUnit(undefined);
        return;
      }
      try {
        const unit = await unitsProvider.findUnitByName(firstUnitName);
        if (disposed) return;
        setPersistenceUnit(unit);
      } catch (error) {
        Logger.logError(QuantityFormattingLoggerCategory, "Failed to load the persistence unit", () => ({ unit: firstUnitName, error: BentleyError.getErrorMessage(error) }));
        if (disposed) return;
        setPersistenceUnit(undefined);
      }
    };

    void loadPersistenceUnit();
    return () => {
      disposed = true;
    };
  }, [firstUnitName, unitsProvider]);

  const handleOnFormatChanged = React.useCallback((newProps: FormatDefinition) => {
    setClonedFormatDefinition(newProps);
    setSaveEnabled(true);
  }, []);

  const handleSave = React.useCallback(async () => {
    const request = ++saveRequest.current;
    setIsSaving(true);
    setSaveError(false);
    try {
      const format = await Format.createFromJSON("custom", unitsProvider, clonedFormatDefinition);
      if (format.units?.length || format.type === FormatType.Bearing || format.type === FormatType.Azimuth) {
        const spec = await FormatterSpec.create(format.name, format, unitsProvider, format.units?.[0][0]);
        // Some providers return invalid conversion metadata rather than rejecting spec creation.
        spec.applyFormatting(1);
      }
    } catch (error) {
      if (request !== saveRequest.current) return;
      Logger.logError(QuantityFormattingLoggerCategory, "Failed to validate the edited format", () => ({ error: BentleyError.getErrorMessage(error) }));
      setSaveError(true);
      setIsSaving(false);
      return;
    }
    if (request !== saveRequest.current) return;
    setIsSaving(false);
    onFormatChange(clonedFormatDefinition);
    setSaveEnabled(false);
  }, [onFormatChange, clonedFormatDefinition, unitsProvider]);

  const handleClear = React.useCallback(() => {
    setClonedFormatDefinition({...formatDefinition});
    setSaveEnabled(false);
  }, [formatDefinition]);

  return (
    <div className="components-quantityFormat-quantityPanel">
      {showSample && (
        <FormatSample
          formatProps={clonedFormatDefinition}
          unitsProvider={unitsProvider}
          persistenceUnit={persistenceUnit}
          initialMagnitude={props.initialMagnitude ?? 1234.5678}
        />
      )}
      <FormatPanel
        formatProps={clonedFormatDefinition}
        unitsProvider={unitsProvider}
        onFormatChange={handleOnFormatChanged}
        persistenceUnit={persistenceUnit}
      />
      <div className="quantityFormat--quantityPanel-footer">
        <Flex justifyContent="flex-end" gap="xs">
          <Button size="small" styleType="default" onClick={handleClear} disabled={!saveEnabled}>
            {translate("QuantityFormat:labels.revert")}
          </Button>
          <Button size="small" styleType="high-visibility" onClick={() => void handleSave()} disabled={!saveEnabled || isSaving}>
            {translate("QuantityFormat:labels.apply")}
          </Button>
        </Flex>
        {saveError && <div role="alert">{translate("QuantityFormat:errors.invalidFormat")}</div>}
      </div>
    </div>
  );
}
