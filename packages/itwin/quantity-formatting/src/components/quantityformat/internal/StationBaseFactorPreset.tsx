/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";
import type { FormatDefinition } from "@itwin/core-quantity";
import { Button, ButtonGroup, Label } from "@itwin/itwinui-react";
import { useTranslation } from "../../../useTranslation.js";

/** Properties of [[StationBaseFactorPreset]] component.
 * @internal
 */
export interface StationBaseFactorPresetProps {
  formatProps: FormatDefinition;
  onChange?: (format: FormatDefinition) => void;
}

/** Component to provide preset station base factor and offset size combinations.
 * Provides quick selection for common station configurations.
 * @internal
 */
export function StationBaseFactorPreset(props: StationBaseFactorPresetProps) {
  const { formatProps, onChange } = props;
  const { translate } = useTranslation();

  const currentBaseFactor = React.useMemo(() => {
    return (formatProps as any).stationBaseFactor ?? 1;
  }, [formatProps]);

  const currentOffsetSize = React.useMemo(() => {
    return formatProps.stationOffsetSize ?? 2;
  }, [formatProps]);

  // Determine which preset is currently active
  const activePreset = React.useMemo(() => {
    if (currentOffsetSize === 2 && currentBaseFactor === 1) return "100";
    if (currentOffsetSize === 2 && currentBaseFactor === 5) return "500";
    if (currentOffsetSize === 3 && currentBaseFactor === 1) return "1000";
    return undefined;
  }, [currentOffsetSize, currentBaseFactor]);

  const handlePresetChange = React.useCallback(
    (preset: string) => {
      let newOffsetSize: number;
      let newBaseFactor: number;

      switch (preset) {
        case "100":
          newOffsetSize = 2;
          newBaseFactor = 1;
          break;
        case "500":
          newOffsetSize = 2;
          newBaseFactor = 5;
          break;
        case "1000":
          newOffsetSize = 3;
          newBaseFactor = 1;
          break;
        default:
          return;
      }

      const newFormatProps = {
        ...formatProps,
        stationOffsetSize: newOffsetSize,
        stationBaseFactor: newBaseFactor,
      };

      onChange && onChange(newFormatProps);
    },
    [formatProps, onChange]
  );

  return (
    <div className="quantityFormat--formatInlineRow">
      <Label displayStyle="inline">
        {translate("QuantityFormat:labels.stationPresetLabel")}
      </Label>
      <ButtonGroup>
        <Button
          onClick={() => handlePresetChange("100")}
          styleType={activePreset === "100" ? "cta" : "default"}
          size="small"
        >
          100
        </Button>
        <Button
          onClick={() => handlePresetChange("500")}
          styleType={activePreset === "500" ? "cta" : "default"}
          size="small"
        >
          500
        </Button>
        <Button
          onClick={() => handlePresetChange("1000")}
          styleType={activePreset === "1000" ? "cta" : "default"}
          size="small"
        >
          1000
        </Button>
      </ButtonGroup>
    </div>
  );
}
