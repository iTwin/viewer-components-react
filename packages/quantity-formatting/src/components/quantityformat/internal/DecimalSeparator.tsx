/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { FormatDefinition } from "@itwin/core-quantity";
import { Label } from "@itwin/itwinui-react";
import { DecimalSeparatorSelector } from "./misc/DecimalSeparator.js";
import { resolveSeparatorConflict } from "./FormatPropsUtils.js";
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
      onChange(resolveSeparatorConflict({ ...formatProps, decimalSeparator }, "decimalSeparator"));
    },
    [formatProps, onChange]
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
