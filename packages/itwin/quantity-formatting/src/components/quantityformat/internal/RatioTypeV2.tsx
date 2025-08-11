/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { FormatProps } from "@itwin/core-quantity";
import { parseRatioType, RatioType } from "@itwin/core-quantity";
import { IconButton, LabeledSelect } from "@itwin/itwinui-react";
import type { SelectOption } from "@itwin/itwinui-react";
import { SvgHelpCircularHollow } from "@itwin/itwinui-icons-react";
import { useTranslation } from "../../../useTranslation.js";
import "../FormatPanelV2.scss";

/** Properties of [[RatioTypeV2]] component.
 * @internal
 */
export interface RatioTypeV2Props {
  formatProps: FormatProps;
  onChange?: (format: FormatProps) => void;
}

/** Component to show/edit ratio type.
 * @internal
 */
export function RatioTypeV2(props: RatioTypeV2Props) {
  const { formatProps, onChange } = props;
  const { translate } = useTranslation();

  const handleSetFormatProps = React.useCallback(
    (newProps: FormatProps) => {
      onChange && onChange(newProps);
    },
    [onChange]
  );

  const handleRatioTypeChange = React.useCallback(
    (type: RatioType) => {
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
      : RatioType.NToOne;
  }, [formatProps.ratioType]);

  const formatOptions: SelectOption<RatioType>[] = React.useMemo(
    () => [
      {
        value: RatioType.NToOne,
        label: translate("QuantityFormat.ratio-type.n-to-one.label"),
        sublabel: translate("QuantityFormat.ratio-type.n-to-one.description"),
      },
      {
        value: RatioType.OneToN,
        label: translate("QuantityFormat.ratio-type.one-to-n.label"),
        sublabel: translate("QuantityFormat.ratio-type.one-to-n.description"),
      },
      {
        value: RatioType.UseGreatestCommonDivisor,
        label: translate(
          "QuantityFormat.ratio-type.use-greatest-common-divisor.label"
        ),
        sublabel: translate(
          "QuantityFormat.ratio-type.use-greatest-common-divisor.description"
        ),
      },
      {
        value: RatioType.ValueBased,
        label: translate("QuantityFormat.ratio-type.value-based.label"),
        sublabel: translate(
          "QuantityFormat.ratio-type.value-based.description"
        ),
      },
    ],
    [translate]
  );

  return (
    <div className="icr-quantityFormat-v2-formatInlineRow">
      <LabeledSelect
        label={
          <>
            {translate("QuantityFormat.labels.ratioTypeLabel")}
            <IconButton
              className="icr-quantityFormat-v2-formatHelpTooltip"
              styleType="borderless"
              size="small"
              label={translate("QuantityFormat.ratio-type.default.description")}
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
