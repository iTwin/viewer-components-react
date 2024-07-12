/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { IconButton, NotificationMarker, Tooltip } from "@itwin/itwinui-react";
import React from "react";
import { SvgProcess } from "@itwin/itwinui-icons-react";

type IconStatus = "negative" | "positive" | "warning" | undefined;
export interface ExtractionStatusData {
  iconStatus: IconStatus;
  iconMessage: string;
}

export interface ExtractionStatusIconProps {
  iconStatus: IconStatus;
  onClick: () => void;
  iconMessage: string;
}

export const ExtractionStatusIcon = ({ iconStatus, onClick, iconMessage }: ExtractionStatusIconProps) => {
  return (
    <Tooltip content={iconMessage}>
      <IconButton styleType="borderless" onClick={onClick}>
        <NotificationMarker status={iconStatus}>
          <SvgProcess />
        </NotificationMarker>
      </IconButton>
    </Tooltip>
  );
};
