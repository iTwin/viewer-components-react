/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { PanelProps } from "./Decimal.js";
import { Format, FormatTraits } from "@itwin/core-quantity";
import { FormatUnits } from "../internal/FormatUnits.js";
import { FormatTypeOption } from "../internal/misc/FormatType.js";
import {
  AppendUnitLabel,
  UomSeparatorSelector,
} from "../internal/FormatUnitLabel.js";
import { FormatPrecision } from "../internal/FormatPrecision.js";
import { RatioType } from "../internal/RatioType.js";
import { DecimalSeparator } from "../internal/DecimalSeparator.js";
import { ShowTrailingZeros } from "../internal/ShowTrailingZeros.js";
import { SignOption } from "../internal/SignOption.js";
import { KeepDecimalPoint } from "../internal/KeepDecimalPoint.js";
import { KeepSingleZero } from "../internal/KeepSingleZero.js";
import { ZeroEmpty } from "../internal/ZeroEmpty.js";
import {
  ThousandsSeparatorSelector,
  UseThousandsSeparator,
} from "../internal/ThousandsSeparator.js";
import { Divider, Label, Text } from "@itwin/itwinui-react";
import { useTranslation } from "../../../useTranslation.js";
import "../FormatPanel.scss";

/** Primary children component for ratio format (always visible)
 * @internal
 */
export function RatioPrimaryChildren(props: PanelProps): React.ReactElement {
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
      {Format.isFormatTraitSetInProps(
        formatProps,
        FormatTraits.ShowUnitLabel
      ) && (
        <UomSeparatorSelector
          formatProps={formatProps}
          onFormatChange={onFormatChange}
        />
      )}
      <FormatPrecision formatProps={formatProps} onChange={onFormatChange} />
      <RatioType formatProps={formatProps} onChange={onFormatChange} />
      {/* Add precision, ratio type, etc. controls here */}
    </div>
  );
}

/** Returns the primary children for ratio format (always visible)
 * @internal
 */
export function getRatioPrimaryChildren(props: PanelProps): React.ReactNode {
  return <RatioPrimaryChildren {...props} />;
}

/** Secondary children component for ratio format
 * @internal
 */
export function RatioSecondaryChildren(props: PanelProps): React.ReactElement {
  const { formatProps, onFormatChange } = props;

  return (
    <div className="quantityFormat--formatPanel-secondaryChildren">
      <SignOption formatProps={formatProps} onChange={onFormatChange} />
      <DecimalSeparator formatProps={formatProps} onChange={onFormatChange} />
      <UseThousandsSeparator
        formatProps={formatProps}
        onChange={onFormatChange}
      />
      <ThousandsSeparatorSelector
        formatProps={formatProps}
        onChange={onFormatChange}
      />
      <KeepDecimalPoint formatProps={formatProps} onChange={onFormatChange} />
      <ShowTrailingZeros
        formatProps={formatProps}
        onChange={onFormatChange}
      />
      <KeepSingleZero formatProps={formatProps} onChange={onFormatChange} />
      <ZeroEmpty formatProps={formatProps} onChange={onFormatChange} />
    </div>
  );
}

/** Returns the secondary children for ratio format (expandable/collapsible)
 * @internal
 */
export function getRatioSecondaryChildren(props: PanelProps): React.ReactNode {
  return <RatioSecondaryChildren {...props} />;
}
