/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { FormatProps } from "@itwin/core-quantity";
import { parseShowSignOption, type ShowSignOption } from "@itwin/core-quantity";
import { SignOptionSelector } from "./misc/SignOption.js";
import { useTranslation } from "../../../useTranslation.js";
import { IconButton, Label } from "@itwin/itwinui-react";
import { SvgHelpCircularHollow } from "@itwin/itwinui-icons-react";
import "../FormatPanel.scss";

/** Properties of [[SignOption]] component.
 * @internal
 */
export interface SignOptionProps {
  formatProps: FormatProps;
  onChange?: (format: FormatProps) => void;
  disabled?: boolean;
}

/** Component to show/edit Show Sign Option.
 * @internal
 */
export function SignOption(props: SignOptionProps) {
  const { formatProps, onChange, disabled = false } = props;
  const { translate } = useTranslation();
  const showSignOptionId = React.useId();

  const showSignOption = React.useMemo(
    () =>
      parseShowSignOption(
        formatProps.showSignOption ?? "onlyNegative",
        "format"
      ),
    [formatProps.showSignOption]
  );

  const handleShowSignOptionChange = React.useCallback(
    (value: ShowSignOption) => {
      const newFormatProps = { ...formatProps, showSignOption: value };
      onChange && onChange(newFormatProps);
    },
    [formatProps, onChange]
  );

  return (
    <div className="quantityFormat--formatInlineRow">
      <Label displayStyle="inline" id={showSignOptionId}>
        {translate("QuantityFormat.labels.signOptionLabel")}
        <IconButton
          className="quantityFormat--formatHelpTooltip"
          styleType="borderless"
          size="small"
          label={translate("QuantityFormat.labels.signOptionTooltip")}
        >
          <SvgHelpCircularHollow />
        </IconButton>
      </Label>
      <SignOptionSelector
        aria-labelledby={showSignOptionId}
        signOption={showSignOption}
        onChange={handleShowSignOptionChange}
      />
    </div>
  );
}
