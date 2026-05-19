/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { FormatDefinition } from "@itwin/core-quantity";
import { FormatType, parseFormatType } from "@itwin/core-quantity";
import { FractionPrecisionSelector } from "./misc/FractionPrecision.js";
import { useTranslation } from "../../../useTranslation.js";
import { useTelemetryContext } from "../../../hooks/UseTelemetryContext.js";
import { Label } from "@itwin/itwinui-react";
import { DecimalPrecisionSelector } from "./misc/DecimalPrecision.js";

/** Properties of [[FormatPrecision]] component.
 * @internal
 */
export interface FormatPrecisionProps {
  formatProps: FormatDefinition;
  onChange: (format: FormatDefinition) => void;
}

/** Component to show/edit Quantity Format Precision.
 * @internal
 */
export function FormatPrecision(props: FormatPrecisionProps) {
  const { formatProps, onChange } = props;
  const { translate } = useTranslation();
  const { onFeatureUsed } = useTelemetryContext();
  const precisionSelectorId = React.useId();
  const formatType = parseFormatType(formatProps.type, "format");

  const handlePrecisionChange = React.useCallback(
    (value: number) => {
      onFeatureUsed("precision-change");
      onChange({ ...formatProps, precision: value });
    },
    [onChange, formatProps, onFeatureUsed]
  );

  return (
    <div className="quantityFormat--formatInlineRow">
      <Label displayStyle="inline" id={precisionSelectorId}>
        {translate("QuantityFormat:labels.precision")}
      </Label>
      {formatType === FormatType.Fractional ? (
        <FractionPrecisionSelector
          precision={formatProps.precision ?? 0}
          onChange={handlePrecisionChange}
          aria-labelledby={precisionSelectorId}
        />
      ) : (
        <DecimalPrecisionSelector
          precision={formatProps.precision ?? 0}
          onChange={handlePrecisionChange}
          aria-labelledby={precisionSelectorId}
        />
      )}
    </div>
  );
}
