/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { FormatProps } from "@itwin/core-quantity";
import { FormatType, parseFormatType } from "@itwin/core-quantity";
import { FractionPrecisionSelector } from "./misc/FractionPrecision.js";
import { useTranslation } from "../../../useTranslation.js";
import { Label } from "@itwin/itwinui-react";
import { DecimalPrecisionSelector } from "./misc/DecimalPrecision.js";

/** Properties of [[FormatPrecisionV2]] component.
 * @internal
 */
export interface FormatPrecisionV2Props {
  formatProps: FormatProps;
  onChange?: (format: FormatProps) => void;
}

/** Component to show/edit Quantity Format Precision.
 * @internal
 */
export function FormatPrecisionV2(props: FormatPrecisionV2Props) {
  const { formatProps, onChange } = props;
  const { translate } = useTranslation();
  const precisionSelectorId = React.useId();
  const handlePrecisionChange = React.useCallback(
    (precision: number) => {
      const newFormatProps = { ...formatProps, precision };
      onChange && onChange(newFormatProps);
    },
    [formatProps, onChange]
  );

  const formatType = parseFormatType(formatProps.type, "format");

  return (
    <div className="icr-quantityFormat-v2-formatInlineRow">
      <Label displayStyle="inline" id={precisionSelectorId}>
        {translate("QuantityFormat.labels.precision")}
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
