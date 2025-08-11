/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { SelectOption } from "@itwin/itwinui-react";
import { Select } from "@itwin/itwinui-react";
import { useTranslation } from "../../../../useTranslation.js";

/** Properties of [[FractionPrecisionSelector]] component.
 * @internal
 */
export interface FractionPrecisionSelectorProps {
  precision: number;
  onChange: (value: number) => void;
  id?: string;
}

/** Component use to set Fraction precision
 * @internal
 */
export function FractionPrecisionSelector(
  props: FractionPrecisionSelectorProps
) {
  const { precision, onChange, id } = props;
  const { translate } = useTranslation();
  const options: SelectOption<number>[] = [
    {
      value: 1,
      label: translate("QuantityFormat.fraction_precision.whole"),
    },
    {
      value: 2,
      label: translate("QuantityFormat.fraction_precision.half"),
    },
    {
      value: 4,
      label: translate("QuantityFormat.fraction_precision.quarter"),
    },
    {
      value: 8,
      label: translate("QuantityFormat.fraction_precision.eighth"),
    },
    {
      value: 16,
      label: translate("QuantityFormat.fraction_precision.sixteenth"),
    },
    {
      value: 32,
      label: translate("QuantityFormat.fraction_precision.over32"),
    },
    {
      value: 64,
      label: translate("QuantityFormat.fraction_precision.over64"),
    },
    {
      value: 128,
      label: translate("QuantityFormat.fraction_precision.over128"),
    },
    {
      value: 256,
      label: translate("QuantityFormat.fraction_precision.over256"),
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
      options={options}
      value={precision}
      onChange={handleOnChange}
      size="small"
      id={id}
    />
  );
}
