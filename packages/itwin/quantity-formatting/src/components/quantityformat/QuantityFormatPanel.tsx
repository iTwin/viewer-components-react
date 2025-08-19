/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";
import type { UnitProps, FormatDefinition } from "@itwin/core-quantity";
import type { UnitsProvider } from "@itwin/core-quantity";
import { FormatPanel } from "./FormatPanel.js";
import { Button, ButtonGroup, Divider, Flex } from "@itwin/itwinui-react";
import { FormatSample } from "./FormatSample.js";
import { useTranslation } from "../../useTranslation.js";
import "./FormatPanel.scss";

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
    const loadPersistenceUnit = async () => {
      if (
        clonedFormatDefinition.composite &&
        clonedFormatDefinition.composite.units &&
        clonedFormatDefinition.composite.units.length > 0
      ) {
        const firstUnitName = clonedFormatDefinition.composite.units[0].name;
        try {
          const unit = await unitsProvider.findUnitByName(firstUnitName);
          setPersistenceUnit(unit);
        } catch {
          setPersistenceUnit(undefined);
        }
      } else {
        setPersistenceUnit(undefined);
      }
    };

    void loadPersistenceUnit();
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
        <>
          <FormatSample
            formatProps={clonedFormatDefinition}
            unitsProvider={unitsProvider}
            persistenceUnit={persistenceUnit}
            initialMagnitude={props.initialMagnitude ?? 1234.5678}
          />
          <Divider />
        </>
      )}
      <FormatPanel
        formatProps={clonedFormatDefinition}
        unitsProvider={unitsProvider}
        onFormatChange={handleOnFormatChanged}
        persistenceUnit={persistenceUnit}
      />
      <Divider className="quantityFormat-formatPanel-divider" />
      <Flex justifyContent="flex-end" gap="xs">
        <ButtonGroup>
          <Button styleType="default" onClick={handleClear} disabled={!saveEnabled}>
            {translate("QuantityFormat:labels.clear")}
          </Button>
          <Button styleType="high-visibility" onClick={handleSave} disabled={!saveEnabled}>
            {translate("QuantityFormat:labels.save")}
          </Button>
        </ButtonGroup>
      </Flex>
    </div>
  );
}
