/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import { ShowSignOption } from "@itwin/core-quantity";
import type { SelectOption } from "@itwin/itwinui-react";
import { Select } from "@itwin/itwinui-react";
import { useTranslation } from "../../../../useTranslation.js";

interface SignOptionSelectorProps {
  signOption: ShowSignOption;
  onChange: (value: ShowSignOption) => void;
  id?: string;
}

/** Component use to set Sign option.
 * @internal
 */
export function SignOptionSelector(props: SignOptionSelectorProps) {
  const { signOption, onChange, id } = props;
  const { translate } = useTranslation();
  const options: SelectOption<ShowSignOption>[] = [
    {
      value: ShowSignOption.NoSign,
      label: translate("QuantityFormat:sign_option.noSign"),
    },
    {
      value: ShowSignOption.OnlyNegative,
      label: translate("QuantityFormat:sign_option.onlyNegative"),
    },
    {
      value: ShowSignOption.SignAlways,
      label: translate("QuantityFormat:sign_option.signAlways"),
    },
    {
      value: ShowSignOption.NegativeParentheses,
      label: translate("QuantityFormat:sign_option.negativeParentheses"),
    },
  ];

  return (
    <Select
      options={options}
      value={signOption}
      onChange={(newValue) => onChange(newValue)}
      size="small"
      id={id}
    />
  );
}
