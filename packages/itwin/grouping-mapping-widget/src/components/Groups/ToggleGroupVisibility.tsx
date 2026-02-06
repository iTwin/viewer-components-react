/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { ToggleSwitch } from "@itwin/itwinui-react";
import React from "react";
import { GroupingMappingWidget } from "../../GroupingMappingWidget";
import "./ToggleGroupVisibility.scss";

export interface ToggleGroupVisibilityProps {
  isLoadingQuery: boolean;
  showGroupColor: boolean;
  setShowGroupColor: (value: ((prevState: boolean) => boolean) | boolean) => void;
}

export const ToggleGroupVisibility = ({ isLoadingQuery, showGroupColor, setShowGroupColor }: ToggleGroupVisibilityProps) => (
  <ToggleSwitch
    label={GroupingMappingWidget.translate("groups.colorByGroup")}
    labelPosition="left"
    className="gmw-toggle"
    disabled={isLoadingQuery}
    checked={showGroupColor}
    onChange={() => setShowGroupColor((b) => !b)}
  />
);
