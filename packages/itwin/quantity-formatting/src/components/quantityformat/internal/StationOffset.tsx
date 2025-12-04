/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import * as React from "react";
import type { FormatProps } from "@itwin/core-quantity";
import { StationSizeSelector } from "./misc/StationSizeSelector.js";
import { useTranslation } from "../../../useTranslation.js";
import { Label } from "@itwin/itwinui-react";

/** Properties of [[StationOffset]] component.
 * @internal
 */
export interface StationOffsetProps {
  formatProps: FormatProps;
  onChange: (format: FormatProps) => void;
}

/** Component to show/edit Station Format Offset Size.
 * @internal
 */
export function StationOffset(props: StationOffsetProps) {
  const { formatProps, onChange } = props;
  const { translate } = useTranslation();
  const stationOffsetSelectorId = React.useId();

  return (
    <div className="quantityFormat--formatInlineRow">
      <Label displayStyle="inline" id={stationOffsetSelectorId}>
        {translate("QuantityFormat:labels.stationOffsetLabel")}
      </Label>
      <StationSizeSelector
        aria-labelledby={stationOffsetSelectorId}
        value={formatProps.stationOffsetSize ?? 2}
        onChange={(value) => onChange({ ...formatProps, stationOffsetSize: value })}
      />
    </div>
  );
}
