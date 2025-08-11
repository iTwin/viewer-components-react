/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { FormatProps } from "@itwin/core-quantity";
import { StationSizeSelector } from "./misc/StationSizeSelector.js";
import { useTranslation } from "../../../useTranslation.js";
import { Label } from "@itwin/itwinui-react";

/** Properties of [[StationOffsetV2]] component.
 * @internal
 */
export interface StationOffsetV2Props {
  formatProps: FormatProps;
  onChange?: (format: FormatProps) => void;
  disabled?: boolean;
}

/** Component to show/edit Station Format Offset Size.
 * @internal
 */
export function StationOffsetV2(props: StationOffsetV2Props) {
  const { formatProps, onChange, disabled = false } = props;
  const { translate } = useTranslation();
  const stationOffsetSelectorId = React.useId();

  const handleStationOffsetChange = React.useCallback(
    (value: number) => {
      const newFormatProps = { ...formatProps, stationOffsetSize: value };
      onChange && onChange(newFormatProps);
    },
    [formatProps, onChange]
  );

  return (
    <div className="icr-quantityFormat-v2-formatInlineRow">
      <Label displayStyle="inline" id={stationOffsetSelectorId}>
        {translate("QuantityFormat.labels.stationOffsetLabel")}
      </Label>
      <StationSizeSelector
        aria-labelledby={stationOffsetSelectorId}
        value={formatProps.stationOffsetSize ?? 2}
        onChange={handleStationOffsetChange}
      />
    </div>
  );
}
