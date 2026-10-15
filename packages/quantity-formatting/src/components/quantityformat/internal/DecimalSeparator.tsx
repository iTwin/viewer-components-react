/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { FormatDefinition } from "@itwin/core-quantity";
import { FormatTraits } from "@itwin/core-quantity";
import { Label } from "@itwin/itwinui-react";
import { DecimalSeparatorSelector } from "./misc/DecimalSeparator.js";
import { getDecimalSeparator, isFormatTraitSet, resolveSeparatorConflict } from "./FormatPropsUtils.js";
import { useTranslation } from "../../../useTranslation.js";

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

  const decimalSeparatorSelectorId = React.useId();

  const handleDecimalSeparatorChange = React.useCallback(
    (decimalSeparator: string) => {
      const newFormatProps = { ...formatProps, decimalSeparator };
      onChange(isFormatTraitSet(newFormatProps, FormatTraits.Use1000Separator) ? resolveSeparatorConflict(newFormatProps, "decimalSeparator") : newFormatProps);
    },
    [formatProps, onChange]
  );

  return (
    <div className="quantityFormat--formatInlineRow">
      <Label displayStyle="inline" id={decimalSeparatorSelectorId}>
        {translate("QuantityFormat:labels.decimalSeparatorLabel")}
      </Label>
      <DecimalSeparatorSelector
        separator={getDecimalSeparator(formatProps)}
        onChange={handleDecimalSeparatorChange}
        aria-labelledby={decimalSeparatorSelectorId}
      />
    </div>
  );
}
