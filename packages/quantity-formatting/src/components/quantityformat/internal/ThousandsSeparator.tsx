/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { FormatProps } from "@itwin/core-quantity";
import { FormatTraits } from "@itwin/core-quantity";
import { getThousandSeparator, isFormatTraitSet, resolveSeparatorConflict, setFormatTrait } from "./FormatPropsUtils.js";
import { Checkbox, IconButton, Label } from "@itwin/itwinui-react";
import { SvgHelpCircularHollow } from "@itwin/itwinui-icons-react";
import { useTranslation } from "../../../useTranslation.js";
import { ThousandsSelector } from "./misc/ThousandsSelector.js";

/** Properties of [[UseThousandsSeparator]] component.
 * @internal
 */
export interface UseThousandsSeparatorProps {
  formatProps: FormatProps;
  onChange: (format: FormatProps) => void;
}

/** Component to enable/disable the use of thousand separator.
 * @internal
 */
export function UseThousandsSeparator(props: UseThousandsSeparatorProps) {
  const { formatProps, onChange } = props;
  const { translate } = useTranslation();

  const useThousandsId = React.useId();

  const handleUseThousandsSeparatorChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newFormatProps = setFormatTrait(formatProps, FormatTraits.Use1000Separator, e.target.checked);
      onChange(e.target.checked ? resolveSeparatorConflict(newFormatProps, "decimalSeparator") : newFormatProps);
    },
    [formatProps, onChange]
  );

  return (
    <div className="quantityFormat--formatInlineRow">
      <Label displayStyle="inline" htmlFor={useThousandsId}>
        {translate("QuantityFormat:labels.useThousandSeparatorLabel")}
      </Label>
      <Checkbox
        id={useThousandsId}
        checked={isFormatTraitSet(formatProps, FormatTraits.Use1000Separator)}
        onChange={handleUseThousandsSeparatorChange}
      />
    </div>
  );
}

/** Properties of [[ThousandsSeparatorSelector]] component.
 * @internal
 */
export interface ThousandsSeparatorSelectorProps {
  formatProps: FormatProps;
  onChange: (format: FormatProps) => void;
}

/** Component to select the thousands separator character.
 * @internal
 */
export function ThousandsSeparatorSelector(
  props: ThousandsSeparatorSelectorProps
) {
  const { formatProps, onChange } = props;
  const { translate } = useTranslation();

  const thousandsSelectorId = React.useId();

  const handleThousandSeparatorChange = React.useCallback(
    (thousandSeparator: string) => {
      onChange(resolveSeparatorConflict({ ...formatProps, thousandSeparator }, "thousandSeparator"));
    },
    [formatProps, onChange]
  );

  // Only show if the Use1000Separator trait is set
  if (!isFormatTraitSet(formatProps, FormatTraits.Use1000Separator)) {
    return null;
  }

  return (
    <div className="quantityFormat--formatInlineRow">
      <Label displayStyle="inline" htmlFor={thousandsSelectorId}>
        {translate("QuantityFormat:labels.thousandSeparatorLabel")}
      </Label>
      <IconButton
        className="quantityFormat--formatHelpTooltip"
        styleType="borderless"
        size="small"
        label={translate("QuantityFormat:labels.thousandSelectorTooltip")}
      >
        <SvgHelpCircularHollow />
      </IconButton>
      <ThousandsSelector
        separator={getThousandSeparator(formatProps)}
        onChange={handleThousandSeparatorChange}
        id={thousandsSelectorId}
      />
    </div>
  );
}
