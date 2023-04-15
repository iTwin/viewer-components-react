/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ButtonGroup, IconButton } from "@itwin/itwinui-react";
import React from "react";
import { ToggleGroupVisibility } from "./ToggleGroupVisibility";
import { SvgVisibilityHide, SvgVisibilityShow } from "@itwin/itwinui-icons-react";
import "./GroupsVisualizationActions.scss";
import { useGroupHilitedElementsContext } from "./context/GroupHilitedElementsContext";

interface GroupVisualizationActionsProps {
  isLoadingQuery: boolean;
  showAll: () => Promise<void>;
  hideAll: () => Promise<void>;
}

export const GroupVisualizationActions = ({
  isLoadingQuery,
  showAll,
  hideAll,
}: GroupVisualizationActionsProps) => {
  const {
    showGroupColor,
    setShowGroupColor,
  } = useGroupHilitedElementsContext();

  return (
    <ButtonGroup className="gmw-visual-buttons">
      <ToggleGroupVisibility
        isLoadingQuery={isLoadingQuery}
        showGroupColor={showGroupColor}
        setShowGroupColor={setShowGroupColor}
      />
      <IconButton
        title="Show All"
        onClick={showAll}
        disabled={isLoadingQuery}
        styleType="borderless"
      >
        <SvgVisibilityShow />
      </IconButton>
      <IconButton
        title="Hide All"
        onClick={hideAll}
        disabled={isLoadingQuery}
        styleType="borderless"
      >
        <SvgVisibilityHide />
      </IconButton>
    </ButtonGroup>
  );

};

