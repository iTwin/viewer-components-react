/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import { IconButton } from "@itwin/itwinui-react";
import type { GroupMinimal } from "@itwin/insights-client";
import { getGroupColor } from "./groupsHelpers";
import "./GroupColorLegend.scss";

interface GroupColorLegendProps {
  group: GroupMinimal;
  groups: GroupMinimal[];
}

export const GroupColorLegend = ({ group, groups }: GroupColorLegendProps) => (
  <IconButton styleType="borderless">
    <div
      className="gmw-color-legend"
      style={{
        backgroundColor: getGroupColor(groups.findIndex((g) => g.id === group.id)),
      }}
    />
  </IconButton>
);
