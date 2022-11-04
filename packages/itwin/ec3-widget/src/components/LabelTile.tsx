/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import { IconButton, Text } from "@itwin/itwinui-react";
import {
  SvgDelete,
} from "@itwin/itwinui-icons-react";
import "./LabelTile.scss";

interface LabelTileProps {
  title: string;
  onDelete: () => void;
  subText?: string;
  onClickTitle?: () => void;
  titleTooltip?: string;
  subtextToolTip?: string;
}

export const LabelTile = ({ title, subText, onClickTitle, titleTooltip, subtextToolTip, onDelete }: LabelTileProps) => {

  return (
    <div className="ec3-label-tile-container" data-testid="label-tile">
      <div className="body">
        <Text className={`body-text ${onClickTitle ? "iui-anchor" : ""}`} onClick={onClickTitle} variant="body" title={titleTooltip}>{title}</Text>
        {subText && <Text className="body-text" isMuted={true} title={subtextToolTip} variant="small">{subText}</Text>}
      </div>
      <IconButton
        styleType="borderless"
        className="delete-icon"
        onClick={onDelete}
      >
        <SvgDelete />
      </IconButton>
    </div>
  );

};
