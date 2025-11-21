/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { FormatProps } from "@itwin/core-quantity";
import { Format, FormatTraits, getTraitString } from "@itwin/core-quantity";
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
      onChange({...formatProps, formatTraits});
    },
    [formatProps, onChange]
  );

  return (
    <div className="quantityFormat-formatInlineRow">
      <Label displayStyle="inline" htmlFor={showTrailZerosId}>
        {translate("QuantityFormat:labels.showTrailZerosLabel")}
      </Label>
      <Checkbox
        id={showTrailZerosId}
        checked={Format.isFormatTraitSetInProps(
          formatProps,
          FormatTraits.TrailZeroes
        )}
        onChange={(e) => setFormatTrait(FormatTraits.TrailZeroes, e.target.checked)}
      />
    </div>
  );
}
