/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import { ListItem } from "@itwin/itwinui-react";
import "./GroupPropertyListItem.scss";

export interface GroupPropertyListItemProps {
  name: string;
  titleTooltip: string;
  subText: string;
  selected?: boolean;
  onClick?: () => void;
  action?: JSX.Element;
  dragHandle?: JSX.Element;
}

export const GroupPropertyListItem = (props: GroupPropertyListItemProps) => {
  return (
    <ListItem
      active={props.selected}
      onClick={props.onClick}
      className="gmw-group-property-list-item"
      title={props.titleTooltip}>
      {props.dragHandle}
      <ListItem.Content>
        {props.name}
        <ListItem.Description>
          {props.subText}
        </ListItem.Description>
      </ListItem.Content>
      {props.action}
    </ListItem>
  );
};
