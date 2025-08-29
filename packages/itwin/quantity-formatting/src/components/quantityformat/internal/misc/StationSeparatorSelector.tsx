/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { SelectOption } from "@itwin/itwinui-react";
import { Select } from "@itwin/itwinui-react";
import { useTranslation } from "../../../../useTranslation.js";

/** Properties of [[StationSeparatorSelector]] component.
 * @internal
 */
export interface StationSeparatorSelectorProps {
  separator: string;
  onChange: (value: string) => void;
  id?: string;
}

/** Component use to setStation separator.
 * @internal
 */
export function StationSeparatorSelector(props: StationSeparatorSelectorProps) {
  const { separator, onChange, id } = props;
  const { translate } = useTranslation();

  const separatorOptions = React.useMemo(() => {
    const uomDefaultEntries: SelectOption<string>[] = [
      {
        value: "+",
        label: translate("QuantityFormat:station_separator.plus"),
      },
      {
        value: "-",
        label: translate("QuantityFormat:station_separator.minus"),
      },
      {
        value: " ",
        label: translate("QuantityFormat:station_separator.blank"),
      },
      {
        value: "^",
        label: translate("QuantityFormat:station_separator.caret"),
      },
    ];
    const completeListOfEntries: SelectOption<string>[] = [];
    if (
      undefined ===
      uomDefaultEntries.find((option) => option.value === separator)
    ) {
      completeListOfEntries.push({ value: separator, label: separator });
    }
    completeListOfEntries.push(...uomDefaultEntries);
    return completeListOfEntries;
  }, [separator, translate]);

  return (
    <Select
      id={id}
      options={separatorOptions}
      value={separator}
      onChange={(value) => onChange(value)}
      size="small"
    />
  );
}
