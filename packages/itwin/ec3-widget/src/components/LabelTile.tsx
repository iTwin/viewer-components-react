/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { IconButton, Text } from "@itwin/itwinui-react";
import { SvgDelete } from "@itwin/itwinui-icons-react";
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
    <div className="ec3w-label-tile-container">
      <div className="ec3w-body">
        <Text className={`ec3w-body-text ${onClickTitle ? "iui-anchor" : ""}`} onClick={onClickTitle} variant="body" title={titleTooltip}>
          {title}
        </Text>
        {subText && (
          <Text className="ec3w-body-text" isMuted={true} title={subtextToolTip} variant="small">
            {subText}
          </Text>
        )}
      </div>
      <IconButton styleType="borderless" className="ec3w-delete-icon" data-testid="ec3-labels-delete-button" onClick={onDelete}>
        <SvgDelete />
      </IconButton>
    </div>
  );
};
