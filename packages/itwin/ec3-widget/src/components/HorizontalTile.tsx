/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { ReactNode } from "react";
import React from "react";
import { Text } from "@itwin/itwinui-react";
import "./HorizontalTile.scss";
import classNames from "classnames";

interface HorizontalTileProps extends React.ComponentPropsWithoutRef<"div"> {
  title: string;
  button: ReactNode;
  subText?: string;
  onClickTitle?: () => void;
  titleTooltip?: string;
  subtextToolTip?: string;
  selected: boolean;
}

export const HorizontalTile = ({ title, subText, onClickTitle, titleTooltip, subtextToolTip, button, selected, ...rest }: HorizontalTileProps) => {
  return (
    <div
      className={classNames("ec3w-horizontal-tile-container", { "ec3w-horizontal-tile-container-selected": selected })}
      data-testid="ec3-horizontal-tile"
      onClick={rest.onClick}
    >
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
      <div className="ec3w-action-button" data-testid="ec3-tile-action-button">
        {button}
      </div>
    </div>
  );
};
