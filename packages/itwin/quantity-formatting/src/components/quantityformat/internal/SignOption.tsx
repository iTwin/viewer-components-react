/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { FormatProps } from "@itwin/core-quantity";
import { parseShowSignOption, type ShowSignOption } from "@itwin/core-quantity";
import { SignOptionSelector } from "./misc/SignOption.js";
import { useTranslation } from "../../../useTranslation.js";
import { useTelemetryContext } from "../../../hooks/UseTelemetryContext.js";
import { IconButton, Label } from "@itwin/itwinui-react";
import { SvgHelpCircularHollow } from "@itwin/itwinui-icons-react";
import "../FormatPanel.scss";

/** Properties of [[SignOption]] component.
 * @internal
 */
export interface SignOptionProps {
  formatProps: FormatProps;
  onChange: (format: FormatProps) => void;
}

/** Component to show/edit Show Sign Option.
 * @internal
 */
export function SignOption(props: SignOptionProps) {
  const { formatProps, onChange } = props;
  const { translate } = useTranslation();
  const { onFeatureUsed } = useTelemetryContext();
  const showSignOptionId = React.useId();

  const showSignOption = React.useMemo(
    () =>
      parseShowSignOption(
        formatProps.showSignOption ?? "onlyNegative",
        "format"
      ),
    [formatProps.showSignOption]
  );

  return (
    <div className="quantityFormat--formatInlineRow">
      <Label displayStyle="inline" id={showSignOptionId}>
        {translate("QuantityFormat:labels.signOptionLabel")}
        <IconButton
          className="quantityFormat--formatHelpTooltip"
          styleType="borderless"
          size="small"
          label={translate("QuantityFormat:labels.signOptionTooltip")}
        >
          <SvgHelpCircularHollow />
        </IconButton>
      </Label>
      <SignOptionSelector
        aria-labelledby={showSignOptionId}
        signOption={showSignOption}
        onChange={(value: ShowSignOption) => {
          onFeatureUsed("sign-option-change");
          onChange({ ...formatProps, showSignOption: value });
        }}
      />
    </div>
  );
}
