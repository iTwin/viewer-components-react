/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { FormatProps } from "@itwin/core-quantity";
import { Format, FormatTraits, getTraitString } from "@itwin/core-quantity";
import { Checkbox, IconButton, Label } from "@itwin/itwinui-react";
import { SvgHelpCircularHollow } from "@itwin/itwinui-icons-react";
import { useTranslation } from "../../../useTranslation.js";
import { ThousandsSelector } from "./misc/ThousandsSelector.js";

/** Properties of [[UseThousandsSeparator]] component.
 * @internal
 */
export interface UseThousandsSeparatorProps {
  formatProps: FormatProps;
  onChange?: (format: FormatProps) => void;
}

/** Component to enable/disable the use of thousand separator.
 * @internal
 */
export function UseThousandsSeparator(props: UseThousandsSeparatorProps) {
  const { formatProps, onChange } = props;
  const { translate } = useTranslation();

  const useThousandsId = React.useId();

  const handleSetFormatProps = React.useCallback(
    (newProps: FormatProps) => {
      onChange && onChange(newProps);
    },
    [onChange]
  );

  const setFormatTrait = React.useCallback(
    (trait: FormatTraits, setActive: boolean) => {
      const traitStr = getTraitString(trait);
      let formatTraits: string[] = [traitStr];
      if (setActive) {
        // setting trait
        if (formatProps.formatTraits) {
          const traits = Array.isArray(formatProps.formatTraits)
            ? formatProps.formatTraits
            : formatProps.formatTraits.split(/,|;|\|/);
          formatTraits = [...traits, traitStr];
        }
      } else {
        // clearing trait
        if (formatProps.formatTraits) {
          const traits = Array.isArray(formatProps.formatTraits)
            ? formatProps.formatTraits
            : formatProps.formatTraits.split(/,|;|\|/);
          formatTraits = traits.filter((traitEntry) => traitEntry !== traitStr);
        }
      }
      const newFormatProps = { ...formatProps, formatTraits };
      handleSetFormatProps(newFormatProps);
    },
    [formatProps, handleSetFormatProps]
  );

  const handleUseThousandsSeparatorChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormatTrait(FormatTraits.Use1000Separator, e.target.checked);
    },
    [setFormatTrait]
  );

  const isFormatTraitSet = React.useCallback(
    (trait: FormatTraits) => {
      return Format.isFormatTraitSetInProps(formatProps, trait);
    },
    [formatProps]
  );

  return (
    <div className="quantityFormat--formatInlineRow">
      <Label displayStyle="inline" htmlFor={useThousandsId}>
        {translate("QuantityFormat.labels.useThousandSeparatorLabel")}
      </Label>
      <Checkbox
        id={useThousandsId}
        checked={isFormatTraitSet(FormatTraits.Use1000Separator)}
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
  onChange?: (format: FormatProps) => void;
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

  const handleSetFormatProps = React.useCallback(
    (newProps: FormatProps) => {
      onChange && onChange(newProps);
    },
    [onChange]
  );

  const isFormatTraitSet = React.useCallback(
    (trait: FormatTraits) => {
      return Format.isFormatTraitSetInProps(formatProps, trait);
    },
    [formatProps]
  );

  const handleThousandSeparatorChange = React.useCallback(
    (thousandSeparator: string) => {
      let decimalSeparator = formatProps.decimalSeparator;
      // make sure 1000 and decimal separator do not match
      if (isFormatTraitSet(FormatTraits.Use1000Separator)) {
        if (thousandSeparator === ".") decimalSeparator = ",";
        // thousandSeparator === ","
        else decimalSeparator = ".";
      }
      const newFormatProps = {
        ...formatProps,
        thousandSeparator,
        decimalSeparator,
      };
      handleSetFormatProps(newFormatProps);
    },
    [formatProps, isFormatTraitSet, handleSetFormatProps]
  );

  // Only show if the Use1000Separator trait is set
  if (!isFormatTraitSet(FormatTraits.Use1000Separator)) {
    return null;
  }

  return (
    <div className="quantityFormat--formatInlineRow">
      <Label displayStyle="inline" htmlFor={thousandsSelectorId}>
        {translate("QuantityFormat.labels.thousandSeparatorLabel")}
      </Label>
      <IconButton
        className="quantityFormat--formatHelpTooltip"
        styleType="borderless"
        size="small"
        label={translate("QuantityFormat.labels.thousandSelectorTooltip")}
      >
        <SvgHelpCircularHollow />
      </IconButton>
      <ThousandsSelector
        separator={formatProps.thousandSeparator ?? ","}
        onChange={handleThousandSeparatorChange}
        id={thousandsSelectorId}
      />
    </div>
  );
}
