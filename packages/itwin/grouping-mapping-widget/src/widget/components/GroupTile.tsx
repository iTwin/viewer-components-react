/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { ReactNode } from "react";
import React from "react";
import { Text } from "@itwin/itwinui-react";
import "./GroupTile.scss";

interface GroupTileProps {
  title: string;
  actionGroup: ReactNode;
  subText?: string;
  onClickTitle?: () => void;
  titleTooltip?: string;
  subtextToolTip?: string;
}

export const GroupTile = ({ title, subText, onClickTitle, titleTooltip, subtextToolTip, actionGroup }: GroupTileProps) => {

  return (
    <div className="gmw-group-tile-container" data-testid="group-tile">
      <div className="body">
        <Text className={`body-text ${onClickTitle ? "iui-anchor" : ""}`} onClick={onClickTitle} variant="body" title={titleTooltip}>{title}</Text>
        <Text className="body-text" isMuted={true} title={subtextToolTip} variant="small">{subText}</Text>
      </div>
      <div className="action-button" data-testid="tile-action-button">
        {actionGroup}
      </div>
    </div>
  );

};
