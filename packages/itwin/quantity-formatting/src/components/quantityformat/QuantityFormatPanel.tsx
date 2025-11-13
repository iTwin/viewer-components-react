/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./FormatPanel.scss";
import * as React from "react";
import { Button, Flex, Text } from "@itwin/itwinui-react";
import { useTranslation } from "../../useTranslation.js";
import { FormatPanel } from "./FormatPanel.js";
import { FormatSample } from "./FormatSample.js";

import type { UnitProps, FormatDefinition, UnitsProvider } from "@itwin/core-quantity";
/** Properties of [[QuantityFormatPanel]] component.
 * @beta
 */
export interface QuantityFormatPanelProps {
  formatDefinition: FormatDefinition;
  unitsProvider: UnitsProvider;
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
    unitsProvider,
    onFormatChange,
    showSample = true,
  } = props;

  const { translate } = useTranslation();

  // Clone the formatDefinition to work with internally
  const [clonedFormatDefinition, setClonedFormatDefinition] = React.useState<FormatDefinition>(() =>
  ({ ...formatDefinition })
  );

  const [saveEnabled, setSaveEnabled] = React.useState(false);

  const [persistenceUnit, setPersistenceUnit] = React.useState<
    UnitProps | undefined
  >(undefined);

  // Update the cloned format definition when the prop changes
  React.useEffect(() => {
    setClonedFormatDefinition({ ...formatDefinition });
    setSaveEnabled(false);
  }, [formatDefinition]);

  // Generate persistenceUnit from first composite unit
  React.useEffect(() => {
    let disposed = false;
    const loadPersistenceUnit = async () => {
      if (
        clonedFormatDefinition.composite &&
        clonedFormatDefinition.composite.units &&
        clonedFormatDefinition.composite.units.length > 0
      ) {
        const firstUnitName = clonedFormatDefinition.composite.units[0].name;
        try {
          const unit = await unitsProvider.findUnitByName(firstUnitName);
          if (disposed) return;
          setPersistenceUnit(unit);
        } catch {
          if (disposed) return;
          setPersistenceUnit(undefined);
        }
      } else {
        if (disposed) return;
        setPersistenceUnit(undefined);
      }
    };

    void loadPersistenceUnit();
    return () => {
      disposed = true;
    };
  }, [clonedFormatDefinition.composite, unitsProvider]);

  const handleOnFormatChanged = React.useCallback(
    async (newProps: FormatDefinition) => {
      setClonedFormatDefinition(newProps);
      setSaveEnabled(true);
    },
    []
  );

  const handleSave = React.useCallback(() => {
    onFormatChange && onFormatChange(clonedFormatDefinition);
    setSaveEnabled(false);
  }, [onFormatChange, clonedFormatDefinition]);

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
      <Flex justifyContent="flex-end" gap="xs">
        <Button size="small" styleType="default" onClick={handleClear} disabled={!saveEnabled}>
          {translate("QuantityFormat:labels.clear")}
        </Button>
        <Button size="small" styleType="high-visibility" onClick={handleSave} disabled={!saveEnabled}>
          {translate("QuantityFormat:labels.apply")}
        </Button>
      </Flex>
    </div>
  );
}
