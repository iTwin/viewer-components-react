/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { GroupMinimal } from "@itwin/insights-client";
import { SvgVisibilityHide, SvgVisibilityShow } from "@itwin/itwinui-icons-react";
import { IconButton } from "@itwin/itwinui-react";
import React, { useCallback, useMemo } from "react";
import { useGroupHilitedElementsContext } from "../context/GroupHilitedElementsContext";

interface GroupsShowHideButtonsProps {
  group: GroupMinimal;
  isLoadingQuery: boolean;
  showGroup: (group: GroupMinimal) => void;
  hideGroup: (group: GroupMinimal) => void;
}

export const GroupsShowHideButtons = ({ group, isLoadingQuery, showGroup, hideGroup }: GroupsShowHideButtonsProps) => {
  const { hiddenGroupsIds, setHiddenGroupsIds } = useGroupHilitedElementsContext();
  const isGroupHidden = useMemo(() => group.id && hiddenGroupsIds.has(group.id), [group.id, hiddenGroupsIds]);

  const toggleGroupVisibility = useCallback(() => {
    if (isGroupHidden) {
      showGroup(group);
      setHiddenGroupsIds(new Set([...hiddenGroupsIds].filter((id) => group.id !== id)));
    } else {
      hideGroup(group);
      if (group.id) {
        setHiddenGroupsIds(new Set([...hiddenGroupsIds, group.id]));
      }
    }
  }, [group, hiddenGroupsIds, hideGroup, isGroupHidden, setHiddenGroupsIds, showGroup]);

  return (
    <IconButton disabled={isLoadingQuery} styleType="borderless" onClick={toggleGroupVisibility} title="Toggle Group Visibility">
      {isGroupHidden ? <SvgVisibilityHide /> : <SvgVisibilityShow />}
    </IconButton>
  );
};
