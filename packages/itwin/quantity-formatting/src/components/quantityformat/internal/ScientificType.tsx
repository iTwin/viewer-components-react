/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { FormatProps } from "@itwin/core-quantity";
import { parseScientificType, ScientificType as CoreScientificType } from "@itwin/core-quantity";
import { IconButton, LabeledSelect } from "@itwin/itwinui-react";
import type { SelectOption } from "@itwin/itwinui-react";
import { SvgHelpCircularHollow } from "@itwin/itwinui-icons-react";
import { useTranslation } from "../../../useTranslation.js";
import "../FormatPanel.scss";

/** Properties of [[ScientificType]] component.
 * @internal
 */
export interface ScientificTypeProps {
  formatProps: FormatProps;
  onChange: (format: FormatProps) => void;
}

/** Component to show/edit scientific type.
 * @internal
 */
export function ScientificType(props: ScientificTypeProps) {
  const { formatProps, onChange } = props;
  const { translate } = useTranslation();

  const currentType = React.useMemo(() => {
    return formatProps.scientificType && formatProps.scientificType.length > 0
      ? parseScientificType(formatProps.scientificType, "custom")
      : CoreScientificType.Normalized;
  }, [formatProps.scientificType]);

  const formatOptions: SelectOption<CoreScientificType>[] = React.useMemo(
    () => [
      {
        value: CoreScientificType.Normalized,
        label: translate("QuantityFormat:scientific-type.normalized"),
      },
      {
        value: CoreScientificType.ZeroNormalized,
        label: translate("QuantityFormat:scientific-type.zero-normalized"),
      },
    ],
    [translate]
  );

  return (
    <div className="quantityFormat-formatInlineRow">
      <LabeledSelect
        label={
          <>
            {translate("QuantityFormat:labels.scientificTypeLabel")}
            <IconButton
              className="quantityFormat-formatHelpTooltip"
              styleType="borderless"
              size="small"
              label={translate("QuantityFormat:labels.scientificTypeTooltip")}
            >
              <SvgHelpCircularHollow />
            </IconButton>
          </>
        }
        options={formatOptions}
        value={currentType}
        onChange={(type: CoreScientificType) => onChange({ ...formatProps, scientificType: type })}
        size="small"
      />
    </div>
  );
}
