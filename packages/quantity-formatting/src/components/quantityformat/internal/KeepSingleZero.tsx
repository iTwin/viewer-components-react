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

/** Properties of [[KeepSingleZero]] component.
 * @internal
 */
export interface KeepSingleZeroProps {
  formatProps: FormatProps;
  onChange: (format: FormatProps) => void;
}

/** Component to show/edit Keep Single Zero setting.
 * @internal
 */
export function KeepSingleZero(props: KeepSingleZeroProps) {
  const { formatProps, onChange } = props;
  const { translate } = useTranslation();
  const keepSingleZeroId = React.useId();

  const handleTraitChange = React.useCallback(
    (trait: FormatTraits, setActive: boolean) => onChange(setFormatTrait(formatProps, trait, setActive)),
    [formatProps, onChange]
  );

  return (
    <div className="quantityFormat--formatInlineRow">
      <Label displayStyle="inline" htmlFor={keepSingleZeroId}>
        {translate("QuantityFormat:labels.keepSingleZeroLabel")}
      </Label>
      <Checkbox
        id={keepSingleZeroId}
        checked={isFormatTraitSet(formatProps, FormatTraits.KeepSingleZero)}
        onChange={(e) => handleTraitChange(FormatTraits.KeepSingleZero, e.target.checked)}
      />
    </div>
  );
}
