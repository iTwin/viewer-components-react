/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Group, GroupMinimal } from "@itwin/insights-client";
import { ProgressLinear } from "@itwin/itwinui-react";
import React from "react";
import type { OverlappedInfo } from "../context/GroupHilitedElementsContext";

interface OverlapProgressProps {
  group: Group | GroupMinimal;
  groupElementsInfo: Map<string, number>;
  overlappedElementsInfo: Map<string, OverlappedInfo[]>;
}

export const OverlapProgress = ({ group, groupElementsInfo, overlappedElementsInfo }: OverlapProgressProps) => {
  const groupId = group.id;
  const totalElements = groupElementsInfo.get(groupId) || 0;
  const overlappedInfo = overlappedElementsInfo.get(groupId) || [];
  const overlappedElements = overlappedInfo.reduce((count, info) => count + info.elements.length, 0);
  const overlapPercentage = (totalElements ? overlappedElements / totalElements : 0) * 100;

  return (
    <ProgressLinear
      title={`${overlappedElements} element${overlappedElements === 1 ? "" : "s"} overlapping out of ${totalElements} `}
      value={overlapPercentage}
      isAnimated
      status="negative"
    />
  );
};
