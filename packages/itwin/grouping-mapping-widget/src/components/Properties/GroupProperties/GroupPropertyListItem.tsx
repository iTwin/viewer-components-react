/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { ListItem } from "@itwin/itwinui-react";
import "./GroupPropertyListItem.scss";

export interface GroupPropertyListItemProps {
  content: string;
  title: string;
  description: string;
  selected?: boolean;
  onClick?: () => void;
  action?: JSX.Element;
  dragHandle?: JSX.Element;
}

export const GroupPropertyListItem = ({ content, title, description, selected, onClick, action, dragHandle }: GroupPropertyListItemProps) => (
  <ListItem active={selected} onClick={onClick} className="gmw-group-property-list-item" title={title}>
    {dragHandle}
    <ListItem.Content>
      {content}
      <ListItem.Description>{description}</ListItem.Description>
    </ListItem.Content>
    {action}
  </ListItem>
);
