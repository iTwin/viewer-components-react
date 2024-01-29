/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ButtonGroup, IconButton, ToggleSwitch } from "@itwin/itwinui-react";
import React from "react";
import { ToggleGroupVisibility } from "./ToggleGroupVisibility";
import { SvgVisibilityHide, SvgVisibilityShow } from "@itwin/itwinui-icons-react";
import "./GroupsVisualizationActions.scss";
import { useGroupHilitedElementsContext } from "../context/GroupHilitedElementsContext";

interface GroupVisualizationActionsProps {
  disabled: boolean;
  isVisualizationEnabled: boolean;
  onClickVisualizationButton: () => void;
  showAll: () => void;
  hideAll: () => void;
}

export const GroupVisualizationActions = ({
  disabled,
  isVisualizationEnabled,
  onClickVisualizationButton,
  showAll,
  hideAll,
}: GroupVisualizationActionsProps) => {
  const {
    showGroupColor,
    setShowGroupColor,
  } = useGroupHilitedElementsContext();

  return (
    <ButtonGroup className="gmw-visual-buttons">
      <ToggleSwitch
        label="Visualization"
        labelPosition="left"
        checked={isVisualizationEnabled}
        onChange={onClickVisualizationButton}
      />
      <ButtonGroup>
        <ToggleGroupVisibility
          isLoadingQuery={disabled}
          showGroupColor={showGroupColor}
          setShowGroupColor={setShowGroupColor}
        />
        <IconButton
          title="Show All"
          onClick={showAll}
          disabled={disabled}
          styleType="borderless"
        >
          <SvgVisibilityShow />
        </IconButton>
        <IconButton
          title="Hide All"
          onClick={hideAll}
          disabled={disabled}
          styleType="borderless"
        >
          <SvgVisibilityHide />
        </IconButton>
      </ButtonGroup>
    </ButtonGroup >
  );

};

