/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Group } from "@itwin/insights-client";
import React from "react";
import { HorizontalTile } from "./HorizontalTile";
import type { ContextCustomUI, GroupingCustomUI } from "./customUI/GroupingMappingCustomUI";
import type { GroupsProps } from "./Grouping";
import { GroupMenuActions } from "./GroupMenuActions";

export interface GroupItemProps extends Omit<GroupsProps, "onClickAddGroup"> {
  group: Group;
  groupUIs: GroupingCustomUI[];
  contextUIs: ContextCustomUI[];
  setShowDeleteModal: (showDeleteModal: Group) => void;
}

export const GroupItem = ({
  onClickGroupTitle,
  disableActions,
  group,
  ...rest
}: GroupItemProps) => {

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
      onClickTitle={onClickGroupTitle && !disableActions ? onTitleClick : undefined}
    />
  );
};
