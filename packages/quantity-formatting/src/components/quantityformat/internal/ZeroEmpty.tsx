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

/** Properties of [[ZeroEmpty]] component.
 * @internal
 */
export interface ZeroEmptyProps {
  formatProps: FormatProps;
  onChange: (format: FormatProps) => void;
}

/** Component to show/edit Zero Empty setting.
 * @internal
 */
export function ZeroEmpty(props: ZeroEmptyProps) {
  const { formatProps, onChange } = props;
  const { translate } = useTranslation();
  const zeroEmptyId = React.useId();

  const handleTraitChange = React.useCallback(
    (trait: FormatTraits, setActive: boolean) => onChange(setFormatTrait(formatProps, trait, setActive)),
    [formatProps, onChange]
  );

  return (
    <div className="quantityFormat--formatInlineRow">
      <Label displayStyle="inline" htmlFor={zeroEmptyId}>
        {translate("QuantityFormat:labels.zeroEmptyLabel")}
      </Label>
      <Checkbox
        id={zeroEmptyId}
        checked={isFormatTraitSet(formatProps, FormatTraits.ZeroEmpty)}
        onChange={(e) => handleTraitChange(FormatTraits.ZeroEmpty, e.target.checked)}
      />
    </div>
  );
}
