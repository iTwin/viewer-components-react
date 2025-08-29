/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { FormatDefinition } from "@itwin/core-quantity";
import { Format, FormatTraits, getTraitString } from "@itwin/core-quantity";
import type { SelectOption } from "@itwin/itwinui-react";
import { Checkbox, Label, LabeledSelect } from "@itwin/itwinui-react";
import { useTranslation } from "../../../useTranslation.js";

/** Properties of [[UomSeparatorSelector]] component.
 * @internal
 */
interface UomSeparatorSelectorProps {
  formatProps: FormatDefinition;
  onFormatChange: (formatProps: FormatDefinition) => void;
}

/** Component to set the unit of measure separator.
 * @internal
 */
export function UomSeparatorSelector(props: UomSeparatorSelectorProps) {
  const { formatProps, onFormatChange } = props;
  const { translate } = useTranslation();

  const separatorOptions: SelectOption<string>[] = React.useMemo(() => {
    const uomDefaultEntries: SelectOption<string>[] = [
      { value: "", label: translate("QuantityFormat:none") },
      { value: " ", label: translate("QuantityFormat:space") },
      { value: "-", label: translate("QuantityFormat:dash") },
    ];

    const completeListOfEntries: SelectOption<string>[] = [];
    const separator = formatProps.uomSeparator ?? "";
    if (separator.length > 0) {
      // if the separator is not in the default list, add it
      if (
        undefined ===
        uomDefaultEntries.find((option) => option.value === separator)
      ) {
        completeListOfEntries.push({ value: separator, label: separator });
      }
    }
    completeListOfEntries.push(...uomDefaultEntries);
    return completeListOfEntries;
  }, [formatProps.uomSeparator, translate]);

  return (
    <div className="quantityFormat--formatInlineRow">
      <LabeledSelect
        label={translate("QuantityFormat:labels.labelSeparator")}
        options={separatorOptions}
        value={formatProps.uomSeparator ?? ""}
        onChange={(value: string) => onFormatChange({ ...formatProps, uomSeparator: value })}
        size="small"
        displayStyle="inline"
      />
    </div>
  );
}

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

  const setFormatTrait = React.useCallback(
    (trait: FormatTraits, setActive: boolean) => {
      if (setActive) {
        const newFormatProps = {
          ...formatProps,
          formatTraits: formatProps.formatTraits
            ? [...formatProps.formatTraits, getTraitString(trait)]
            : [getTraitString(trait)],
        };
        onFormatChange(newFormatProps);
      } else {
        const formatTraits = formatProps.formatTraits;
        if (Array.isArray(formatTraits)) {
          const newFormatProps = {
            ...formatProps,
            formatTraits: formatTraits.filter(
              (entry: string) => entry !== getTraitString(trait)
            ),
          };
          onFormatChange(newFormatProps);
        } else {
          onFormatChange({ ...formatProps, formatTraits: [] });
        }
      }
    },
    [formatProps, onFormatChange]
  );

  const isFormatTraitSet = React.useCallback(
    (trait: FormatTraits) => {
      return Format.isFormatTraitSetInProps(formatProps, trait);
    },
    [formatProps]
  );

  return (
    <div className="quantityFormat--formatInlineRow quantityFormat--appendUnitLabel">
      <Label htmlFor={appendUnitLabelId}>
        {translate("QuantityFormat:labels.appendUnitLabel")}
      </Label>
      <Checkbox
        id={appendUnitLabelId}
        checked={isFormatTraitSet(FormatTraits.ShowUnitLabel)}
        onChange={(e) => setFormatTrait(FormatTraits.ShowUnitLabel, e.target.checked)}
      />
    </div>
  );
}
