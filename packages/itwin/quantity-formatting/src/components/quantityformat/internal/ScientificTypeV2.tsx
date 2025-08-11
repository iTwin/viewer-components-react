/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { FormatProps } from "@itwin/core-quantity";
import { parseScientificType, ScientificType } from "@itwin/core-quantity";
import { IconButton, LabeledSelect } from "@itwin/itwinui-react";
import type { SelectOption } from "@itwin/itwinui-react";
import { SvgHelpCircularHollow } from "@itwin/itwinui-icons-react";
import { useTranslation } from "../../../useTranslation.js";
import "../FormatPanelV2.scss";

/** Properties of [[ScientificTypeV2]] component.
 * @internal
 */
export interface ScientificTypeV2Props {
  formatProps: FormatProps;
  onChange?: (format: FormatProps) => void;
  disabled?: boolean;
}

/** Component to show/edit scientific type.
 * @internal
 */
export function ScientificTypeV2(props: ScientificTypeV2Props) {
  const { formatProps, onChange, disabled = false } = props;
  const { translate } = useTranslation();

  const handleSetFormatProps = React.useCallback(
    (newProps: FormatProps) => {
      onChange && onChange(newProps);
    },
    [onChange]
  );

  const handleScientificTypeChange = React.useCallback(
    (type: ScientificType) => {
      const newFormatProps = {
        ...formatProps,
        scientificType: type,
      };
      handleSetFormatProps(newFormatProps);
    },
    [formatProps, handleSetFormatProps]
  );

  const currentType = React.useMemo(() => {
    return formatProps.scientificType && formatProps.scientificType.length > 0
      ? parseScientificType(formatProps.scientificType, "custom")
      : ScientificType.Normalized;
  }, [formatProps.scientificType]);

  const formatOptions: SelectOption<ScientificType>[] = React.useMemo(
    () => [
      {
        value: ScientificType.Normalized,
        label: translate("QuantityFormat.scientific-type.normalized"),
      },
      {
        value: ScientificType.ZeroNormalized,
        label: translate("QuantityFormat.scientific-type.zero-normalized"),
      },
    ],
    [translate]
  );

  return (
    <div className="icr-quantityFormat-v2-formatInlineRow">
      <LabeledSelect
        label={
          <>
            {translate("QuantityFormat.labels.scientificTypeLabel")}
            <IconButton
              className="icr-quantityFormat-v2-formatHelpTooltip"
              styleType="borderless"
              size="small"
              label={translate("QuantityFormat.labels.scientificTypeTooltip")}
            >
              <SvgHelpCircularHollow />
            </IconButton>
          </>
        }
        options={formatOptions}
        value={currentType}
        onChange={handleScientificTypeChange}
        size="small"
        disabled={disabled}
      />
    </div>
  );
}
