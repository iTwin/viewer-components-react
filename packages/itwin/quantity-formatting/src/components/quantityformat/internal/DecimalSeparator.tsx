/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { FormatProps } from "@itwin/core-quantity";
import { Format, FormatTraits } from "@itwin/core-quantity";
import { Label } from "@itwin/itwinui-react";
import { DecimalSeparatorSelector } from "./misc/DecimalSeparator.js";
import { useTranslation } from "../../../useTranslation.js";

/** Properties of [[DecimalSeparator]] component.
 * @internal
 */
export interface DecimalSeparatorProps {
  formatProps: FormatProps;
  onChange?: (format: FormatProps) => void;
}

/** Component to show/edit decimal separator.
 * @internal
 */
export function DecimalSeparator(props: DecimalSeparatorProps) {
  const { formatProps, onChange } = props;
  const { translate } = useTranslation();

  const decimalSeparatorSelectorId = React.useId();

  const handleSetFormatProps = React.useCallback(
    (newProps: FormatProps) => {
      onChange && onChange(newProps);
    },
    [onChange]
  );

  const handleDecimalSeparatorChange = React.useCallback(
    (decimalSeparator: string) => {
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
      handleSetFormatProps(newFormatProps);
    },
    [formatProps, handleSetFormatProps]
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
