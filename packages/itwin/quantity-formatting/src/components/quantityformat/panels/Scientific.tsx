/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *---------------------------------------------------------------------------------------------*/


import "../FormatPanel.scss";
import * as React from "react";
import { Format, FormatTraits } from "@itwin/core-quantity";
import { Divider, Label, Text } from "@itwin/itwinui-react";
import { useTranslation } from "../../../useTranslation.js";
import { DecimalSeparator } from "../internal/DecimalSeparator.js";
import { FormatPrecision } from "../internal/FormatPrecision.js";
import { AppendUnitLabel, UomSeparatorSelector } from "../internal/FormatUnitLabel.js";
import { FormatUnits } from "../internal/FormatUnits.js";
import { KeepDecimalPoint } from "../internal/KeepDecimalPoint.js";
import { KeepSingleZero } from "../internal/KeepSingleZero.js";
import { FormatTypeOption } from "../internal/misc/FormatType.js";
import { ScientificType } from "../internal/ScientificType.js";
import { ShowTrailingZeros } from "../internal/ShowTrailingZeros.js";
import { SignOption } from "../internal/SignOption.js";
import { ThousandsSeparatorSelector, UseThousandsSeparator } from "../internal/ThousandsSeparator.js";
import { ZeroEmpty } from "../internal/ZeroEmpty.js";

import type { PanelProps } from "./Decimal.js";
/** Primary children component for scientific format
 * @internal
 */
export function ScientificPrimaryChildren(
  props: PanelProps
): React.ReactElement {
  const { formatProps, onFormatChange, unitsProvider, persistenceUnit } = props;
  const { translate } = useTranslation();

  return (
    <div className="quantityFormat--formatPanel-primaryChildren">
      <div className="quantityFormat--formatTypeRow">
        <FormatTypeOption formatProps={formatProps} onChange={onFormatChange} />
      </div>
      <Text variant="small" isMuted={true}>
        {translate("QuantityFormat:labels.formatTypeSublabel")}
      </Text>
      <Divider className="quantityFormat-formatPanel-unit-divider" />
      <Label>{translate("QuantityFormat:labels.units")}</Label>
      <FormatUnits
        unitsProvider={unitsProvider}
        persistenceUnit={persistenceUnit}
        initialFormat={formatProps}
        onUnitsChange={onFormatChange}
      />
      <Divider className="quantityFormat-formatPanel-unit-divider" />
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
      <ScientificType formatProps={formatProps} onChange={onFormatChange} />
    </div>
  );
}


/** Secondary children component for scientific format
 * @internal
 */
export function ScientificSecondaryChildren(
  props: PanelProps
): React.ReactElement {
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
