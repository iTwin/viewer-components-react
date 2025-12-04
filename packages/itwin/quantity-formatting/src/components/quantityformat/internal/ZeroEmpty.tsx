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
      onChange({ ...formatProps, formatTraits });
    },
    [formatProps, onChange]
  );

  return (
    <div className="quantityFormat--formatInlineRow">
      <Label displayStyle="inline" htmlFor={zeroEmptyId}>
        {translate("QuantityFormat:labels.zeroEmptyLabel")}
      </Label>
      <Checkbox
        id={zeroEmptyId}
        checked={Format.isFormatTraitSetInProps(
          formatProps,
          FormatTraits.ZeroEmpty
        )}
        onChange={(e) => setFormatTrait(FormatTraits.ZeroEmpty, e.target.checked)}
      />
    </div>
  );
}
