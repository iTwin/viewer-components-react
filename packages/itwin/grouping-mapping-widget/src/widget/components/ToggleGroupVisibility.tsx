/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ToggleSwitch } from "@itwin/itwinui-react";
import "./ToggleGroupVisibility.scss";
import React from "react";

export interface ToggleGroupVisibilityProps {
  isLoadingQuery: boolean;
  showGroupColor: boolean;
  setShowGroupColor: (value: ((prevState: boolean) => boolean) | boolean) => void;
}

export const ToggleGroupVisibility = ({ isLoadingQuery, showGroupColor, setShowGroupColor }: ToggleGroupVisibilityProps) => (
  <ToggleSwitch
    label="Color by Group"
    labelPosition="left"
    className="gmw-toggle"
    disabled={isLoadingQuery}
    checked={showGroupColor}
    onChange={() => setShowGroupColor((b) => !b)}
  />
);
