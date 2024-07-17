/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { ButtonGroup, IconButton, ToggleSwitch } from "@itwin/itwinui-react";
import React, { useState } from "react";
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
  hideVisualizationToggle?: boolean;
}

export const GroupVisualizationActions = ({
  disabled,
  isVisualizationEnabled,
  onClickVisualizationButton,
  showAll,
  hideAll,
  hideVisualizationToggle,
}: GroupVisualizationActionsProps) => {
  const { showGroupColor, setShowGroupColor } = useGroupHilitedElementsContext();
  const [show, setShow] = useState<boolean>(false);

  return (
    <ButtonGroup className="gmw-visual-buttons">
      {!hideVisualizationToggle && (
        <ToggleSwitch label="Visualization" labelPosition="left" checked={isVisualizationEnabled} onChange={onClickVisualizationButton} />
      )}
      <ButtonGroup>
        <ToggleGroupVisibility isLoadingQuery={disabled} showGroupColor={showGroupColor} setShowGroupColor={setShowGroupColor} />
        <IconButton
          title={show ? "Show All" : "Hide All"}
          onClick={() => {
            show ? showAll() : hideAll();
            setShow(!show);
          }}
          disabled={disabled}
          styleType="borderless"
        >
          {show ? <SvgVisibilityShow /> : <SvgVisibilityHide />}
        </IconButton>
      </ButtonGroup>
    </ButtonGroup>
  );
};
