/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { PanelProps } from "./Decimal.js";
import { FormatUnits } from "../internal/FormatUnits.js";
import { FormatTypeOption } from "../internal/misc/FormatType.js";
import { AppendUnitLabel } from "../internal/FormatUnitLabel.js";
import { FormatPrecision } from "../internal/FormatPrecision.js";
import { Divider, Label, Text } from "@itwin/itwinui-react";
import { useTranslation } from "../../../useTranslation.js";
import "../FormatPanel.scss";
import { DecimalSeparator } from "../internal/DecimalSeparator.js";
import { KeepDecimalPoint } from "../internal/KeepDecimalPoint.js";
import { KeepSingleZero } from "../internal/KeepSingleZero.js";
import { ShowTrailingZeros } from "../internal/ShowTrailingZeros.js";

/** Primary children component for bearing format (always visible)
 * @internal
 */
export function BearingPrimaryChildren(props: PanelProps): React.ReactElement {
  const { formatProps, onFormatChange, unitsProvider, persistenceUnit } = props;
  const { translate } = useTranslation();

  return (
    <div className="quantityFormat--formatPanel-primaryChildren">
      <div className="quantityFormat--formatTypeRow">
        <FormatTypeOption formatProps={formatProps} onChange={onFormatChange} />
      </div>
      <Text variant="small" isMuted={true}>
        {translate("QuantityFormat.labels.formatTypeSublabel")}
      </Text>
      <Divider />
      <Label>{translate("QuantityFormat.labels.units")}</Label>
      <FormatUnits
        unitsProvider={unitsProvider}
        persistenceUnit={persistenceUnit}
        initialFormat={formatProps}
        onUnitsChange={onFormatChange}
      />
      <Divider />
      <AppendUnitLabel
        formatProps={formatProps}
        onFormatChange={onFormatChange}
      />
      <FormatPrecision formatProps={formatProps} onChange={onFormatChange} />
      {/* Add precision, etc. controls here */}
    </div>
  );
}

/** Secondary children component for bearing format (expandable section)
 * @internal
 */
export function BearingSecondaryChildren(
  _props: PanelProps
): React.ReactElement {
  const { formatProps, onFormatChange } = _props;

  return (
    <div className="quantityFormat--formatPanel-secondaryChildren">
      <DecimalSeparator formatProps={formatProps} onChange={onFormatChange} />
      <KeepDecimalPoint formatProps={formatProps} onChange={onFormatChange} />
      <ShowTrailingZeros
        formatProps={formatProps}
        onChange={onFormatChange}
      />
      <KeepSingleZero formatProps={formatProps} onChange={onFormatChange} />
    </div>
  );
}

/** Returns the primary children for bearing format
 * @internal
 */
export function getBearingPrimaryChildren(props: PanelProps): React.ReactNode {
  return <BearingPrimaryChildren {...props} />;
}

/** Returns the secondary children for bearing format
 * @internal
 */
export function getBearingSecondaryChildren(
  props: PanelProps
): React.ReactNode {
  return <BearingSecondaryChildren {...props} />;
}
