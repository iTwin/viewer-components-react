/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { SelectOption } from "@itwin/itwinui-react";
import { Select } from "@itwin/itwinui-react";
import { useTranslation } from "../../../../useTranslation.js";

/** Properties of [[StationSizeSelector]] component.
 * @internal
 */
export interface StationSizeSelectorProps {
  value: number;
  onChange: (value: number) => void;
  id?: string;
}

/** Component use to set Station size (number of digits from right until '+').
 * @internal
 */
export function StationSizeSelector(props: StationSizeSelectorProps) {
  const { value, onChange, id } = props;
  const { translate } = useTranslation();
  const separatorOptions: SelectOption<number>[] = [
    {
      value: 1,
      label: translate("QuantityFormat:station_size.one"),
    },
    {
      value: 2,
      label: translate("QuantityFormat:station_size.two"),
    },
    {
      value: 3,
      label: translate("QuantityFormat:station_size.three"),
    },
    {
      value: 4,
      label: translate("QuantityFormat:station_size.four"),
    },
  ];

  const handleOnChange = React.useCallback(
    (newValue: number) => {
      onChange && onChange(newValue);
    },
    [onChange]
  );

  return (
    <Select
      options={separatorOptions}
      value={value}
      onChange={handleOnChange}
      size="small"
      id={id}
    />
  );
}
