/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { ReactNode } from "react";
import React from "react";
import { Text } from "@itwin/itwinui-react";
import "./HorizontalTile.scss";

interface HorizontalTileProps {
  title: string;
  subText: string;
  button: ReactNode;
  onClickTitle?: () => void;
  titleTooltip?: string;
  subtextToolTip?: string;
}

export const HorizontalTile = ({ title, subText, onClickTitle, titleTooltip, subtextToolTip, button }: HorizontalTileProps) => {

  return (
    <div className="rcw-horizontal-tile-container">
      <div className="body">
        <Text className={`body-text bold ${onClickTitle ? "iui-anchor" : ""}`} onClick={onClickTitle} variant="body" title={titleTooltip}>{title}</Text>
        <Text className="body-text" isMuted={true} title={subtextToolTip} variant="small">{subText}</Text>
      </div>
      <div className="action-button">
        {button}
      </div>
    </div>
  );

};
