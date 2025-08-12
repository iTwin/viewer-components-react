/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { FormatProps } from "@itwin/core-quantity";
import { StationSeparatorSelector } from "./misc/StationSeparatorSelector.js";
import { useTranslation } from "../../../useTranslation.js";
import { Label } from "@itwin/itwinui-react";

/** Properties of [[StationSeparator]] component.
 * @internal
 */
export interface StationSeparatorProps {
  formatProps: FormatProps;
  onChange?: (format: FormatProps) => void;
  disabled?: boolean;
}

/** Component to show/edit Station Format Separator.
 * @internal
 */
export function StationSeparator(props: StationSeparatorProps) {
  const { formatProps, onChange, disabled = false } = props;
  const { translate } = useTranslation();
  const stationSeparatorSelectorId = React.useId();

  const handleStationSeparatorChange = React.useCallback(
    (value: string) => {
      const newFormatProps = { ...formatProps, stationSeparator: value };
      onChange && onChange(newFormatProps);
    },
    [formatProps, onChange]
  );

  return (
    <div className="quantityFormat--formatInlineRow">
      <Label displayStyle="inline" id={stationSeparatorSelectorId}>
        {translate("QuantityFormat.labels.stationSeparatorLabel")}
      </Label>
      <StationSeparatorSelector
        aria-labelledby={stationSeparatorSelectorId}
        separator={formatProps.stationSeparator ?? "+"}
        onChange={handleStationSeparatorChange}
      />
    </div>
  );
}
