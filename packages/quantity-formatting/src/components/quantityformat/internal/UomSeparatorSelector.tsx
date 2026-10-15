/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";
import type { FormatDefinition } from "@itwin/core-quantity";
import type { SelectOption } from "@itwin/itwinui-react";
import { LabeledSelect } from "@itwin/itwinui-react";
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
