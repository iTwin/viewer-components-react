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

/** Properties of [[FractionDash]] component.
 * @internal
 */
export interface FractionDashProps {
  formatProps: FormatProps;
  onChange: (format: FormatProps) => void;
}

/** Component to show/edit Fraction Dash format trait.
 * @internal
 */
export function FractionDash(props: FractionDashProps) {
  const { formatProps, onChange } = props;
  const { translate } = useTranslation();

  const fractionDashId = React.useId();

  const handleTraitChange = React.useCallback(
    (trait: FormatTraits, setActive: boolean) => onChange(setFormatTrait(formatProps, trait, setActive)),
    [formatProps, onChange]
  );

  const handleUseFractionDashChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleTraitChange(FormatTraits.FractionDash, e.target.checked);
    },
    [setFormatTrait]
  );

  return (
    <div className="quantityFormat--formatInlineRow">
      <Label displayStyle="inline" htmlFor={fractionDashId}>
        {translate("QuantityFormat:labels.fractionDashLabel")}
      </Label>
      <Checkbox
        id={fractionDashId}
        checked={isFormatTraitSet(formatProps, FormatTraits.FractionDash)}
        onChange={(e) => handleTraitChange(FormatTraits.FractionDash, e.target.checked)}
      />
    </div>
  );
}
