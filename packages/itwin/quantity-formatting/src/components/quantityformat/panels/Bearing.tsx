/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { PanelProps } from "./Decimal.js";
import { FormatUnitsV2 } from "../internal/FormatUnitsV2.js";
import { FormatTypeOption } from "../internal/misc/FormatType.js";
import { AppendUnitLabelV2 } from "../internal/FormatUnitLabelV2.js";
import { FormatPrecisionV2 } from "../internal/FormatPrecisionV2.js";
import { Divider, Label, Text } from "@itwin/itwinui-react";
import { useTranslation } from "../../../useTranslation.js";
import "../FormatPanelV2.scss";
import { DecimalSeparatorV2 } from "../internal/DecimalSeparatorV2.js";
import { KeepDecimalPointV2 } from "../internal/KeepDecimalPointV2.js";
import { KeepSingleZeroV2 } from "../internal/KeepSingleZeroV2.js";
import { ShowTrailingZerosV2 } from "../internal/ShowTrailingZerosV2.js";

/** Primary children component for bearing format (always visible)
 * @internal
 */
export function BearingPrimaryChildren(props: PanelProps): React.ReactElement {
  const { formatProps, onFormatChange, unitsProvider, persistenceUnit } = props;
  const { translate } = useTranslation();

  return (
    <div className="icr-quantityFormat-v2-formatPanel-primaryChildren">
      <div className="icr-quantityFormat-v2-formatTypeRow">
        <FormatTypeOption formatProps={formatProps} onChange={onFormatChange} />
      </div>
      <Text variant="small" isMuted={true}>
        {translate("QuantityFormat.labels.formatTypeSublabel")}
      </Text>
      <Divider />
      <Label>{translate("QuantityFormat.labels.units")}</Label>
      <FormatUnitsV2
        unitsProvider={unitsProvider}
        persistenceUnit={persistenceUnit}
        initialFormat={formatProps}
        onUnitsChange={onFormatChange}
      />
      <Divider />
      <AppendUnitLabelV2
        formatProps={formatProps}
        onFormatChange={onFormatChange}
      />
      <FormatPrecisionV2 formatProps={formatProps} onChange={onFormatChange} />
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
    <div className="icr-quantityFormat-v2-formatPanel-secondaryChildren">
      <DecimalSeparatorV2 formatProps={formatProps} onChange={onFormatChange} />
      <KeepDecimalPointV2 formatProps={formatProps} onChange={onFormatChange} />
      <ShowTrailingZerosV2
        formatProps={formatProps}
        onChange={onFormatChange}
      />
      <KeepSingleZeroV2 formatProps={formatProps} onChange={onFormatChange} />
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
