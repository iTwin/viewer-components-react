import { ToggleSwitch } from "@itwin/itwinui-react";
import React from "react";

interface ToggleGroupVisibilityProps {
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
