/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { FormatProps } from "@itwin/core-quantity";
import { FormatTraits } from "@itwin/core-quantity";
import { isFormatTraitSet, setFormatTrait } from "./FormatPropsUtils.js";
import { useTranslation } from "../../../useTranslation.js";
import { Checkbox, Label } from "@itwin/itwinui-react";

/** Properties of [[ShowTrailingZeros]] component.
 * @internal
 */
export interface ShowTrailingZerosProps {
  formatProps: FormatProps;
  onChange: (format: FormatProps) => void;
}

/** Component to show/edit Show Trailing Zeros format trait.
 * @internal
 */
export function ShowTrailingZeros(props: ShowTrailingZerosProps) {
  const { formatProps, onChange } = props;
  const { translate } = useTranslation();
  const showTrailZerosId = React.useId();

  const handleTraitChange = React.useCallback(
    (trait: FormatTraits, setActive: boolean) => onChange(setFormatTrait(formatProps, trait, setActive)),
    [formatProps, onChange]
  );

  return (
    <div className="quantityFormat--formatInlineRow">
      <Label displayStyle="inline" htmlFor={showTrailZerosId}>
        {translate("QuantityFormat:labels.showTrailZerosLabel")}
      </Label>
      <Checkbox
        id={showTrailZerosId}
        checked={isFormatTraitSet(formatProps, FormatTraits.TrailZeroes)}
        onChange={(e) => handleTraitChange(FormatTraits.TrailZeroes, e.target.checked)}
      />
    </div>
  );
}
