/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *---------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { PanelProps } from "./Decimal.js";
import { Format, FormatTraits } from "@itwin/core-quantity";
import { FormatUnitsV2 } from "../internal/FormatUnitsV2.js";
import { FormatTypeOption } from "../internal/misc/FormatType.js";
import {
  AppendUnitLabelV2,
  UomSeparatorSelectorV2,
} from "../internal/FormatUnitLabelV2.js";
import { FormatPrecisionV2 } from "../internal/FormatPrecisionV2.js";
import { Divider, Label, Text } from "@itwin/itwinui-react";
import { useTranslation } from "../../../useTranslation.js";
import { ShowTrailingZerosV2 } from "../internal/ShowTrailingZerosV2.js";
import { SignOptionV2 } from "../internal/SignOptionV2.js";
import { KeepDecimalPointV2 } from "../internal/KeepDecimalPointV2.js";
import { KeepSingleZeroV2 } from "../internal/KeepSingleZeroV2.js";
import { ZeroEmptyV2 } from "../internal/ZeroEmptyV2.js";
import {
  ThousandsSeparatorSelector,
  UseThousandsSeparator,
} from "../internal/ThousandsSeparatorV2.js";
import { ScientificTypeV2 } from "../internal/ScientificTypeV2.js";
import "../FormatPanelV2.scss";
import { DecimalSeparatorV2 } from "../internal/DecimalSeparatorV2.js";

/** Primary children component for scientific format
 * @internal
 */
export function ScientificPrimaryChildren(
  props: PanelProps
): React.ReactElement {
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
      {Format.isFormatTraitSetInProps(
        formatProps,
        FormatTraits.ShowUnitLabel
      ) && (
        <UomSeparatorSelectorV2
          formatProps={formatProps}
          onFormatChange={onFormatChange}
        />
      )}
      <FormatPrecisionV2 formatProps={formatProps} onChange={onFormatChange} />
      <ScientificTypeV2 formatProps={formatProps} onChange={onFormatChange} />
    </div>
  );
}

/** Returns the primary children for scientific format
 * @internal
 */
export function getScientificPrimaryChildren(
  props: PanelProps
): React.ReactNode {
  return <ScientificPrimaryChildren {...props} />;
}

/** Secondary children component for scientific format
 * @internal
 */
export function ScientificSecondaryChildren(
  props: PanelProps
): React.ReactElement {
  const { formatProps, onFormatChange } = props;

  return (
    <div className="icr-quantityFormat-v2-formatPanel-secondaryChildren">
      <SignOptionV2 formatProps={formatProps} onChange={onFormatChange} />
      <DecimalSeparatorV2 formatProps={formatProps} onChange={onFormatChange} />
      <UseThousandsSeparator
        formatProps={formatProps}
        onChange={onFormatChange}
      />
      <ThousandsSeparatorSelector
        formatProps={formatProps}
        onChange={onFormatChange}
      />
      <KeepDecimalPointV2 formatProps={formatProps} onChange={onFormatChange} />
      <ShowTrailingZerosV2
        formatProps={formatProps}
        onChange={onFormatChange}
      />
      <KeepSingleZeroV2 formatProps={formatProps} onChange={onFormatChange} />
      <ZeroEmptyV2 formatProps={formatProps} onChange={onFormatChange} />
    </div>
  );
}

/** Returns the secondary children for scientific format
 * @internal
 */
export function getScientificSecondaryChildren(
  props: PanelProps
): React.ReactNode {
  return <ScientificSecondaryChildren {...props} />;
}
