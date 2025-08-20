/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module QuantityFormat
 */

import * as React from "react";
import type { SelectOption } from "@itwin/itwinui-react";
import { Select } from "@itwin/itwinui-react";
import { useTranslation } from "../../../../useTranslation.js";

/** Properties of [[DecimalPrecisionSelector]] component.
 * @internal
 */
export interface DecimalPrecisionSelectorProps {
  precision: number;
  onChange: (value: number) => void;
  id?: string;
}

/** Component use to set Decimal Precision
 * the unit label.
 * @internal
 */
export function DecimalPrecisionSelector(props: DecimalPrecisionSelectorProps) {
  const { precision, onChange, id, ...rest } = props;
  const { translate } = useTranslation();
  const options: SelectOption<number>[] = [
    {
      value: 0,
      label: translate("QuantityFormat:decimal_precision.zero"),
    },
    {
      value: 1,
      label: translate("QuantityFormat:decimal_precision.one"),
    },
    {
      value: 2,
      label: translate("QuantityFormat:decimal_precision.two"),
    },
    {
      value: 3,
      label: translate("QuantityFormat:decimal_precision.three"),
    },
    {
      value: 4,
      label: translate("QuantityFormat:decimal_precision.four"),
    },
    {
      value: 5,
      label: translate("QuantityFormat:decimal_precision.five"),
    },
    {
      value: 6,
      label: translate("QuantityFormat:decimal_precision.six"),
    },
    {
      value: 7,
      label: translate("QuantityFormat:decimal_precision.seven"),
    },
    {
      value: 8,
      label: translate("QuantityFormat:decimal_precision.eight"),
    },
    {
      value: 9,
      label: translate("QuantityFormat:decimal_precision.nine"),
    },
    {
      value: 10,
      label: translate("QuantityFormat:decimal_precision.ten"),
    },
    {
      value: 11,
      label: translate("QuantityFormat:decimal_precision.eleven"),
    },
    {
      value: 12,
      label: translate("QuantityFormat:decimal_precision.twelve"),
    },
  ];

  return (
    <Select
      options={options}
      value={precision}
      onChange={(newValue) => onChange(newValue)}
      size="small"
      id={id}
      {...rest}
    />
  );
}
