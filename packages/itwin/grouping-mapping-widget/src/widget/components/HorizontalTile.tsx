/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { ReactNode } from "react";
import React from "react";
import { Text } from "@itwin/itwinui-react";
import "./HorizontalTile.scss";
import classNames from "classnames";

interface HorizontalTileProps {
  title: string;
  actionGroup: ReactNode;
  subText?: string;
  onClick?: ()=>void;
  onClickTitle?: () => void;
  titleTooltip?: string;
  subtextToolTip?: string;
  selected?: boolean;
}

export const HorizontalTile = ({ title, subText, onClick, onClickTitle, titleTooltip, subtextToolTip, actionGroup, selected}: HorizontalTileProps) => {

  return (
    <div className={classNames("gmw-horizontal-tile-container", {"gmw-horizontal-tile-selected":selected})} onClick={onClick} data-testid="gmw-horizontal-tile">
      <div className="body">
        <Text className={classNames("body-text", {"iui-anchor": onClickTitle})} onClick={onClickTitle} variant="body" title={titleTooltip}>{title}</Text>
        {subText && <Text className="body-text" isMuted={true} title={subtextToolTip} variant="small">{subText}</Text>}
      </div>
      <div className="action-button" data-testid="tile-action-button">
        {actionGroup}
      </div>
    </div>
  );

};
