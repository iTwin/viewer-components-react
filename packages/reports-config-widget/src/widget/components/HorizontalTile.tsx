/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { ReactNode } from "react";
import React from "react";
import { Text } from "@itwin/itwinui-react";
import "./HorizontalTile.scss";
import classNames from "classnames";

export interface HorizontalTileProps extends React.ComponentPropsWithoutRef<"div"> {
  title: string;
  actionGroup: ReactNode;
  subText: string;
  onClickTitle?: React.MouseEventHandler;
  titleTooltip: string;
  subtextToolTip?: string;
  selected?: boolean;
}

export const HorizontalTile = (props: HorizontalTileProps) => {
  const { title, titleTooltip, subText, subtextToolTip, actionGroup, selected, className, onClickTitle, ...rest } = props;

  return (
    <div
      className={classNames("rcw-horizontal-tile-container", { "rcw-horizontal-tile-selected": selected }, className)}
      onClick={rest.onClick}
      data-testid="horizontal-tile"
    >
      <div className="rcw-body-container">
        <div className="rcw-body">
          <Text className={classNames("rcw-body-text", { "iui-anchor": !!onClickTitle })} onClick={onClickTitle} variant="body" title={titleTooltip}>
            {title}
          </Text>
          {subText && (
            <Text className="rcw-body-text" isMuted={true} title={subtextToolTip} variant="small">
              {subText}
            </Text>
          )}
        </div>
      </div>
      <div className="rcw-action-button" data-testid="tile-action-button">
        {actionGroup}
      </div>
    </div>
  );
};
