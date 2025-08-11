/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { FormatProps } from "@itwin/core-quantity";
import { Format, FormatTraits, getTraitString } from "@itwin/core-quantity";
import { Checkbox, Label } from "@itwin/itwinui-react";
import { useTranslation } from "../../../useTranslation.js";
import "../FormatPanelV2.scss";

/** Properties of [[ZeroEmptyV2]] component.
 * @internal
 */
export interface ZeroEmptyV2Props {
  formatProps: FormatProps;
  onChange?: (format: FormatProps) => void;
  disabled?: boolean;
}

/** Component to show/edit Zero Empty setting.
 * @internal
 */
export function ZeroEmptyV2(props: ZeroEmptyV2Props) {
  const { formatProps, onChange, disabled } = props;
  const { translate } = useTranslation();
  const zeroEmptyId = React.useId();

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

  const handleZeroEmptyChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormatTrait(FormatTraits.ZeroEmpty, e.target.checked);
    },
    [setFormatTrait]
  );

  return (
    <div className="icr-quantityFormat-v2-formatInlineRow">
      <Label displayStyle="inline" htmlFor={zeroEmptyId}>
        {translate("QuantityFormat.labels.zeroEmptyLabel")}
      </Label>
      <Checkbox
        id={zeroEmptyId}
        checked={Format.isFormatTraitSetInProps(
          formatProps,
          FormatTraits.ZeroEmpty
        )}
        onChange={handleZeroEmptyChange}
        disabled={disabled}
      />
    </div>
  );
}
