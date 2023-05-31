/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { ReactNode } from "react";
import React from "react";
import { Anchor, Text } from "@itwin/itwinui-react";
import "./HorizontalTile.scss";
import classNames from "classnames";

export interface HorizontalTileProps {
  title: string;
  actionGroup: ReactNode;
  subText?: string;
  onClick?: () => void;
  onClickTitle?: () => void;
  titleTooltip?: string;
  subtextToolTip?: string;
  selected?: boolean;
  dragHandle?: ReactNode;
}

export const HorizontalTile = (props: HorizontalTileProps) => {

  return (
    <div className={classNames("gmw-horizontal-tile-container", { "gmw-horizontal-tile-selected": props.selected })} onClick={props.onClick} data-testid="gmw-horizontal-tile">
      <div className="gmw-body-container">
        {props.dragHandle}
        <div className="gmw-body">
          { !!props.onClickTitle &&
            <Anchor as='button' onClick={props.onClickTitle} title={props.titleTooltip}>{props.title}</Anchor>
          }
          { !props.onClickTitle &&
            <Text className="gmw-body-text" variant="body" title={props.titleTooltip}>{props.title}</Text>
          }
          {props.subText && <Text className="gmw-body-text" isMuted={true} title={props.subtextToolTip} variant="small">{props.subText}</Text>}
        </div>
      </div>
      <div className="gmw-action-button" data-testid="tile-action-button">
        {props.actionGroup}
      </div>
    </div>
  );

};
