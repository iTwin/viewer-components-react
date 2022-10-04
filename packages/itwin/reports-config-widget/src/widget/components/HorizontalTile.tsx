/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { ReactNode } from "react";
import React from "react";
import { Text } from "@itwin/itwinui-react";
import "./HorizontalTile.scss";
import classNames from "classnames";

export interface HorizontalTileProps {
  title: string;
  actionGroup: ReactNode;
  subText?: string;
  onClick?: (e: any) => void;
  onClickTitle?: (e: any) => void;
  titleTooltip?: string;
  subtextToolTip?: string;
  selected?: boolean;
}

export const HorizontalTile = (props: HorizontalTileProps) => {

  return (
    <div
      className={classNames("rcw-horizontal-tile-container", { "rcw-horizontal-tile-selected": props.selected })}
      onClick={props.onClick}
      data-testid="rcw-horizontal-tile"
    >
      <div className="rcw-body-container">
        <div className="rcw-body">
          <Text className={classNames("rcw-body-text", { "iui-anchor": props.onClickTitle })}
            onClick={props.onClickTitle}
            variant="body"
            title={props.titleTooltip}>{props.title}
          </Text>
          {
            props.subText &&
            <Text className="rcw-body-text"
              isMuted={true}
              title={props.subtextToolTip}
              variant="small">{props.subText}
            </Text>
          }
        </div>
      </div>
      <div
        className="rcw-action-button"
        data-testid="tile-action-button">
        {props.actionGroup}
      </div>
    </div>
  );
};
