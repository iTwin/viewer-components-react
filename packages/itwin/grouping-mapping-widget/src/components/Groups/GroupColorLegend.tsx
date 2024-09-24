/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { IconButton } from "@itwin/itwinui-react";
import "./GroupColorLegend.scss";

interface GroupColorLegendProps {
  backgroundColor: string;
}

export const GroupColorLegend = ({ backgroundColor }: GroupColorLegendProps) => (
  <IconButton styleType="borderless">
    <div
      className="gmw-color-legend"
      style={{
        backgroundColor,
      }}
    />
  </IconButton>
);
