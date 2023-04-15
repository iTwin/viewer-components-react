/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Group } from "@itwin/insights-client";
import { SvgVisibilityHide, SvgVisibilityShow } from "@itwin/itwinui-icons-react";
import { IconButton } from "@itwin/itwinui-react";
import React, { useCallback, useMemo } from "react";

interface GroupsShowHideButtonsProps {
  group: Group;
  hiddenGroupsIds: string[];
  isLoadingQuery: boolean;
  setHiddenGroupsIds: (ids: string[]) => void;
  showGroup: (group: Group) => Promise<void>;
  hideGroup: (group: Group) => Promise<void>;
}

export const GroupsShowHideButtons = ({
  group,
  hiddenGroupsIds,
  isLoadingQuery,
  setHiddenGroupsIds,
  showGroup,
  hideGroup,
}: GroupsShowHideButtonsProps) => {
  const isGroupHidden = useMemo(() => group.id && hiddenGroupsIds.includes(group.id), [group.id, hiddenGroupsIds]);

  const toggleGroupVisibility = useCallback(async () => {
    if (isGroupHidden) {
      await showGroup(group);
      setHiddenGroupsIds(hiddenGroupsIds.filter((id) => group.id !== id));
    } else {
      await hideGroup(group);
      setHiddenGroupsIds(hiddenGroupsIds.concat(group.id ? [group.id] : []));
    }
  }, [group, hiddenGroupsIds, hideGroup, isGroupHidden, setHiddenGroupsIds, showGroup]);

  return (
    <IconButton
      disabled={isLoadingQuery}
      styleType="borderless"
      onClick={toggleGroupVisibility}
    >
      {isGroupHidden ? <SvgVisibilityHide /> : <SvgVisibilityShow />}
    </IconButton>
  );
};
