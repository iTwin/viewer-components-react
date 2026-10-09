/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { FormatProps } from "@itwin/core-quantity";
import { FormatTraits } from "@itwin/core-quantity";
import { isFormatTraitSet, setFormatTrait } from "./FormatPropsUtils.js";
import { Checkbox, Label } from "@itwin/itwinui-react";
import { useTranslation } from "../../../useTranslation.js";
import "../FormatPanel.scss";

/** Properties of [[KeepDecimalPoint]] component.
 * @internal
 */
export interface KeepDecimalPointProps {
  formatProps: FormatProps;
  onChange: (format: FormatProps) => void;
}

/** Component to show/edit Keep Decimal Point setting.
 * @internal
 */
export function KeepDecimalPoint(props: KeepDecimalPointProps) {
  const { formatProps, onChange } = props;
  const { translate } = useTranslation();
  const keepDecimalPointId = React.useId();

  const handleTraitChange = React.useCallback(
    (trait: FormatTraits, setActive: boolean) => onChange(setFormatTrait(formatProps, trait, setActive)),
    [formatProps, onChange]
  );

  return (
    <div className="quantityFormat--formatInlineRow">
      <Label displayStyle="inline" htmlFor={keepDecimalPointId}>
        {translate("QuantityFormat:labels.keepDecimalPointLabel")}
      </Label>
      <Checkbox
        id={keepDecimalPointId}
        checked={isFormatTraitSet(formatProps, FormatTraits.KeepDecimalPoint)}
        onChange={(e) => handleTraitChange(FormatTraits.KeepDecimalPoint, e.target.checked)}
      />
    </div>
  );
}
