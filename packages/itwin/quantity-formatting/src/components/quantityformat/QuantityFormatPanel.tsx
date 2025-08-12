/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";
import type { FormatProps, UnitProps } from "@itwin/core-quantity";
import type { UnitsProvider } from "@itwin/core-quantity";
import { FormatPanel } from "./FormatPanel.js";
import { Divider } from "@itwin/itwinui-react";
import { FormatSample } from "./FormatSample.js";

/** Properties of [[QuantityFormatPanel]] component.
 * @beta
 */
export interface QuantityFormatPanelProps {
  formatDefinition: FormatProps;
  unitsProvider: UnitsProvider;
  onFormatChange: (formatProps: FormatProps) => void;
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
  const [persistenceUnit, setPersistenceUnit] = React.useState<
    UnitProps | undefined
  >(undefined);

  // Generate persistenceUnit from first composite unit
  React.useEffect(() => {
    const loadPersistenceUnit = async () => {
      if (
        formatDefinition.composite &&
        formatDefinition.composite.units &&
        formatDefinition.composite.units.length > 0
      ) {
        const firstUnitName = formatDefinition.composite.units[0].name;
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
  }, [formatDefinition.composite, unitsProvider]);

  const handleOnFormatChanged = React.useCallback(
    async (newProps: FormatProps) => {
      onFormatChange && onFormatChange(newProps);
    },
    [onFormatChange]
  );

  return (
    <div className="components-quantityFormat-quantityPanel">
      {showSample && (
        <>
          <FormatSample
            formatProps={formatDefinition}
            unitsProvider={unitsProvider}
            persistenceUnit={persistenceUnit}
            initialMagnitude={props.initialMagnitude}
          />
          <Divider />
        </>
      )}
      <FormatPanel
        formatProps={formatDefinition}
        unitsProvider={unitsProvider}
        onFormatChange={handleOnFormatChanged}
        persistenceUnit={persistenceUnit}
      />
    </div>
  );
}
