/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { FormatProps } from "@itwin/core-quantity";
import { Format, FormatTraits, getTraitString } from "@itwin/core-quantity";
import { Checkbox, Label } from "@itwin/itwinui-react";
import { useTranslation } from "../../../useTranslation.js";

/** Properties of [[FractionDashV2]] component.
 * @internal
 */
export interface FractionDashV2Props {
  formatProps: FormatProps;
  onChange?: (format: FormatProps) => void;
}

/** Component to show/edit Fraction Dash format trait.
 * @internal
 */
export function FractionDashV2(props: FractionDashV2Props) {
  const { formatProps, onChange } = props;
  const { translate } = useTranslation();

  const fractionDashId = React.useId();

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

  const handleUseFractionDashChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormatTrait(FormatTraits.FractionDash, e.target.checked);
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
    <div className="icr-quantityFormat-v2-formatInlineRow">
      <Label displayStyle="inline" htmlFor={fractionDashId}>
        {translate("QuantityFormat.labels.fractionDashLabel")}
      </Label>
      <Checkbox
        id={fractionDashId}
        checked={isFormatTraitSet(FormatTraits.FractionDash)}
        onChange={handleUseFractionDashChange}
      />
    </div>
  );
}
