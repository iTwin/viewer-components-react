/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { FormatProps } from "@itwin/core-quantity";
import { parseRatioType, RatioType as CoreRatioType } from "@itwin/core-quantity";
import { IconButton, LabeledSelect } from "@itwin/itwinui-react";
import type { SelectOption } from "@itwin/itwinui-react";
import { SvgHelpCircularHollow } from "@itwin/itwinui-icons-react";
import { useTranslation } from "../../../useTranslation.js";
import "../FormatPanel.scss";

/** Properties of [[RatioType]] component.
 * @internal
 */
export interface RatioTypeProps {
  formatProps: FormatProps;
  onChange?: (format: FormatProps) => void;
}

/** Component to show/edit ratio type.
 * @internal
 */
export function RatioType(props: RatioTypeProps) {
  const { formatProps, onChange } = props;
  const { translate } = useTranslation();

  const handleSetFormatProps = React.useCallback(
    (newProps: FormatProps) => {
      onChange && onChange(newProps);
    },
    [onChange]
  );

  const handleRatioTypeChange = React.useCallback(
    (type: CoreRatioType) => {
      const newFormatProps = {
        ...formatProps,
        ratioType: type,
      };
      handleSetFormatProps(newFormatProps);
    },
    [formatProps, handleSetFormatProps]
  );

  const currentType = React.useMemo(() => {
    return formatProps.ratioType && formatProps.ratioType.length > 0
      ? parseRatioType(formatProps.ratioType, "custom")
      : CoreRatioType.NToOne;
  }, [formatProps.ratioType]);

  const formatOptions: SelectOption<CoreRatioType>[] = React.useMemo(
    () => [
      {
        value: CoreRatioType.NToOne,
        label: translate("QuantityFormat:ratio-type.n-to-one.label"),
        sublabel: translate("QuantityFormat:ratio-type.n-to-one.description"),
      },
      {
        value: CoreRatioType.OneToN,
        label: translate("QuantityFormat:ratio-type.one-to-n.label"),
        sublabel: translate("QuantityFormat:ratio-type.one-to-n.description"),
      },
      {
        value: CoreRatioType.UseGreatestCommonDivisor,
        label: translate(
          "QuantityFormat:ratio-type.use-greatest-common-divisor.label"
        ),
        sublabel: translate(
          "QuantityFormat:ratio-type.use-greatest-common-divisor.description"
        ),
      },
      {
        value: CoreRatioType.ValueBased,
        label: translate("QuantityFormat:ratio-type.value-based.label"),
        sublabel: translate(
          "QuantityFormat:ratio-type.value-based.description"
        ),
      },
    ],
    [translate]
  );

  return (
    <div className="quantityFormat--formatInlineRow">
      <LabeledSelect
        label={
          <>
            {translate("QuantityFormat:labels.ratioTypeLabel")}
            <IconButton
              className="quantityFormat--formatHelpTooltip"
              styleType="borderless"
              size="small"
              label={translate("QuantityFormat:ratio-type.default.description")}
            >
              <SvgHelpCircularHollow />
            </IconButton>
          </>
        }
        options={formatOptions}
        value={currentType}
        onChange={handleRatioTypeChange}
        size="small"
        displayStyle="inline"
        menuStyle={{ maxInlineSize: "60vw" }}
      />
    </div>
  );
}
