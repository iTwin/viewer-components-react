/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Group } from "@itwin/insights-client";
import React from "react";
import { HorizontalTile } from "../SharedComponents/HorizontalTile";
import type {
  ContextCustomUI,
  GroupingCustomUI,
} from "../customUI/GroupingMappingCustomUI";
import type { GroupsProps } from "./Groups";
import { GroupMenuActions } from "./GroupMenuActions";
import { useGroupHilitedElementsContext } from "../context/GroupHilitedElementsContext";
import { OverlapProgress } from "./GroupOverlapProgressBar";

export interface GroupItemProps extends Omit<GroupsProps, "onClickAddGroup"> {
  group: Group;
  groupUIs: GroupingCustomUI[];
  contextUIs: ContextCustomUI[];
  setShowDeleteModal: (showDeleteModal: Group) => void;
  setActiveOverlapInfoPanelGroup?: (
    activeOverlapInfoPanelGroup: Group
  ) => void;
}

export const GroupItem = ({
  onClickGroupTitle,
  disableActions,
  group,
  isVisualizing,
  ...rest
}: GroupItemProps) => {
  const { overlappedElementsMetadata: { groupElementsInfo, overlappedElementsInfo }, showGroupColor } = useGroupHilitedElementsContext();

  const onTitleClick = () => {
    if (onClickGroupTitle) {
      onClickGroupTitle(group);
    }
  };

  return (
    <HorizontalTile
      title={group.groupName}
      subText={group.description}
      actionGroup={
        <GroupMenuActions
          group={group}
          disableActions={disableActions}
          {...rest}
        />
      }
      elementsInfo={
        overlappedElementsInfo.size > 0 &&
        <OverlapProgress
          group={group}
          overlappedElementsInfo={overlappedElementsInfo}
          groupElementsInfo={groupElementsInfo}
        />
      }
      showGroupColor={showGroupColor}
      isLoading={isVisualizing}
      onClickTitle={
        onClickGroupTitle && !disableActions ? onTitleClick : undefined
      }
    />
  );
};
