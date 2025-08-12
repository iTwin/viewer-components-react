/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { FormatProps } from "@itwin/core-quantity";
import { Format, FormatTraits, getTraitString } from "@itwin/core-quantity";
import { Checkbox, Label } from "@itwin/itwinui-react";
import { useTranslation } from "../../../useTranslation.js";
import "../FormatPanel.scss";

/** Properties of [[KeepSingleZero]] component.
 * @internal
 */
export interface KeepSingleZeroProps {
  formatProps: FormatProps;
  onChange?: (format: FormatProps) => void;
  disabled?: boolean;
}

/** Component to show/edit Keep Single Zero setting.
 * @internal
 */
export function KeepSingleZero(props: KeepSingleZeroProps) {
  const { formatProps, onChange, disabled } = props;
  const { translate } = useTranslation();
  const keepSingleZeroId = React.useId();

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
          if (!traits.find((traitEntry) => traitStr === traitEntry)) {
            formatTraits = [...traits, traitStr];
          }
        }
      } else {
        // clearing trait
        if (!formatProps.formatTraits) return;
        const traits = Array.isArray(formatProps.formatTraits)
          ? formatProps.formatTraits
          : formatProps.formatTraits.split(/,|;|\|/);
        formatTraits = traits.filter((traitEntry) => traitEntry !== traitStr);
      }
      const newFormatProps = { ...formatProps, formatTraits };
      onChange && onChange(newFormatProps);
    },
    [formatProps, onChange]
  );

  const handleKeepSingleZeroChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormatTrait(FormatTraits.KeepSingleZero, e.target.checked);
    },
    [setFormatTrait]
  );

  return (
    <div className="quantityFormat--formatInlineRow">
      <Label displayStyle="inline" htmlFor={keepSingleZeroId}>
        {translate("QuantityFormat.labels.keepSingleZeroLabel")}
      </Label>
      <Checkbox
        id={keepSingleZeroId}
        checked={Format.isFormatTraitSetInProps(
          formatProps,
          FormatTraits.KeepSingleZero
        )}
        onChange={handleKeepSingleZeroChange}
        disabled={disabled}
      />
    </div>
  );
}
