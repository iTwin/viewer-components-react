/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Group } from "@itwin/insights-client";
import React from "react";
import { HorizontalTile } from "./HorizontalTile";
import type { ContextCustomUI, GroupingCustomUI } from "./customUI/GroupingMappingCustomUI";
import type { GroupingProps } from "./Grouping";
import { GroupMenuActions } from "./GroupMenuActions";
import { useGroupHilitedElementsContext } from "./context/GroupHilitedElementsContext";

export interface GroupItemProps extends Omit<GroupingProps, "onClickAddGroup"> {
  group: Group;
  groupUIs: GroupingCustomUI[];
  contextUIs: ContextCustomUI[];
  setShowDeleteModal: (showDeleteModal: Group) => void;
  setIsOverlappedElementsInfoPanelOpen: (isOverlappedElementsInfoPanelOpen: Group) => void;
}

export const GroupItem = ({
  onClickGroupTitle,
  disableActions,
  group,
  isVisualizing,
  ...rest
}: GroupItemProps) => {

  const {groupElementsInfo, overlappedElementsInfo, showGroupColor} = useGroupHilitedElementsContext();

  const onTitleClick = () => {
    if (onClickGroupTitle) {
      onClickGroupTitle(group);
    }
  };

  const elementsInfoString = () => {
    const groupId = group.id;
    const numberOfElementsInGroup = groupElementsInfo.get(groupId);
    const overlappedInfo = overlappedElementsInfo.get(groupId);
    let numberOfOverlappedElementsInGroup = 0;
    if (overlappedInfo){
      overlappedInfo.forEach((array) => {
        numberOfOverlappedElementsInGroup+=array.elements.length;
      });
    }
    return `${numberOfOverlappedElementsInGroup}/${numberOfElementsInGroup} overlaps`;
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
      elementsInfo = {elementsInfoString()}
      showGroupColor = {showGroupColor}
      isVisualizing = {isVisualizing}
      onClickTitle={onClickGroupTitle && !disableActions ? onTitleClick : undefined}
    />
  );
};
