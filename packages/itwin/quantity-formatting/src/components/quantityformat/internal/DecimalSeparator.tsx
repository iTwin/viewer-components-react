/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { FormatDefinition } from "@itwin/core-quantity";
import { Format, FormatTraits } from "@itwin/core-quantity";
import { Label } from "@itwin/itwinui-react";
import { DecimalSeparatorSelector } from "./misc/DecimalSeparator.js";
import { useTranslation } from "../../../useTranslation.js";
import { useTelemetryContext } from "../../../hooks/UseTelemetryContext.js";

/** Properties of [[DecimalSeparator]] component.
 * @internal
 */
export interface DecimalSeparatorProps {
  formatProps: FormatDefinition;
  onChange: (format: FormatDefinition) => void;
}

/** Component to show/edit decimal separator.
 * @internal
 */
export function DecimalSeparator(props: DecimalSeparatorProps) {
  const { formatProps, onChange } = props;
  const { translate } = useTranslation();
  const { onFeatureUsed } = useTelemetryContext();

  const decimalSeparatorSelectorId = React.useId();

  const handleDecimalSeparatorChange = React.useCallback(
    (decimalSeparator: string) => {
      onFeatureUsed("decimal-separator-change");
      let thousandSeparator = formatProps.thousandSeparator;
      // make sure 1000 and decimal separator do not match
      if (
        Format.isFormatTraitSetInProps(
          formatProps,
          FormatTraits.Use1000Separator
        )
      ) {
        switch (decimalSeparator) {
          case ".":
            thousandSeparator = ",";
            break;
          case ",":
            thousandSeparator = ".";
            break;
        }
      }
      const newFormatProps = {
        ...formatProps,
        thousandSeparator,
        decimalSeparator,
      };
      onChange(newFormatProps);
    },
    [formatProps, onChange, onFeatureUsed]
  );

  return (
    <div className="quantityFormat--formatInlineRow">
      <Label displayStyle="inline" id={decimalSeparatorSelectorId}>
        {translate("QuantityFormat:labels.decimalSeparatorLabel")}
      </Label>
      <DecimalSeparatorSelector
        separator={formatProps.decimalSeparator ?? "."}
        onChange={handleDecimalSeparatorChange}
        aria-labelledby={decimalSeparatorSelectorId}
      />
    </div>
  );
}
