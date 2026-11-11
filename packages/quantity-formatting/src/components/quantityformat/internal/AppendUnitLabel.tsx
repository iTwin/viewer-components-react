/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";
import type { FormatDefinition } from "@itwin/core-quantity";
import { FormatTraits } from "@itwin/core-quantity";
import { Checkbox, Label } from "@itwin/itwinui-react";
import { isFormatTraitSet, setFormatTrait } from "./FormatPropsUtils.js";
import { useTranslation } from "../../../useTranslation.js";

/** Properties of [[AppendUnitLabel]] component.
 * @internal
 */
interface AppendUnitLabelProps {
  formatProps: FormatDefinition;
  onFormatChange: (formatProps: FormatDefinition) => void;
}

/** Component to set the append unit label flag.
 * @internal
 */
export function AppendUnitLabel(props: AppendUnitLabelProps) {
  const { formatProps, onFormatChange } = props;
  const { translate } = useTranslation();
  const appendUnitLabelId = React.useId();

  const handleTraitChange = React.useCallback(
    (trait: FormatTraits, setActive: boolean) => onFormatChange(setFormatTrait(formatProps, trait, setActive)),
    [formatProps, onFormatChange]
  );

  return (
    <div className="quantityFormat--formatInlineRow quantityFormat--appendUnitLabel">
      <Label htmlFor={appendUnitLabelId}>
        {translate("QuantityFormat:labels.appendUnitLabel")}
      </Label>
      <Checkbox
        id={appendUnitLabelId}
        checked={isFormatTraitSet(formatProps, FormatTraits.ShowUnitLabel)}
        onChange={(e) => handleTraitChange(FormatTraits.ShowUnitLabel, e.target.checked)}
      />
    </div>
  );
}
