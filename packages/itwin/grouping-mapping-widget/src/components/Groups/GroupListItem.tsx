/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { GroupMinimal } from "@itwin/insights-client";
import React, { useCallback } from "react";
import type {
  ContextCustomUI,
  GroupingCustomUI,
} from "../customUI/GroupingMappingCustomUI";
import type { GroupsProps } from "./Groups";
import { GroupMenuActions } from "./GroupMenuActions";
import { useGroupHilitedElementsContext } from "../context/GroupHilitedElementsContext";
import { OverlapProgress } from "./GroupOverlapProgressBar";
import { Anchor, ListItem } from "@itwin/itwinui-react";
import "./GroupListItem.scss";

export interface GroupListItemProps extends Omit<GroupsProps, "onClickAddGroup"> {
  group: GroupMinimal;
  groupUIs: GroupingCustomUI[];
  contextUIs: ContextCustomUI[];
  setShowDeleteModal: (showDeleteModal: GroupMinimal) => void;
  setActiveOverlapInfoPanelGroup?: (
    activeOverlapInfoPanelGroup: GroupMinimal
  ) => void;
}

export const GroupListItem = ({
  onClickGroupTitle,
  disableActions,
  group,
  ...rest
}: GroupListItemProps) => {
  const { overlappedElementsMetadata: { groupElementsInfo, overlappedElementsInfo }, showGroupColor } = useGroupHilitedElementsContext();

  const onTitleClick = useCallback(() => {
    if (onClickGroupTitle) {
      onClickGroupTitle(group);
    }
  }, [group, onClickGroupTitle]);

  return (
    <ListItem
      title={group.groupName}
      key={group.id}
      className="gmw-group-list-item"
      data-testid="group-list-item"
    >
      <ListItem.Content>
        {onClickGroupTitle ? <Anchor onClick={onTitleClick}>{group.groupName}</Anchor> : group.groupName}
        <ListItem.Description>
          {group.description}
        </ListItem.Description>
      </ListItem.Content>
      {showGroupColor && overlappedElementsInfo.size > 0 &&
        <OverlapProgress
          group={group}
          overlappedElementsInfo={overlappedElementsInfo}
          groupElementsInfo={groupElementsInfo}
        />}
      <GroupMenuActions
        group={group}
        disableActions={disableActions}
        {...rest}
      />
    </ListItem>
  );
};
