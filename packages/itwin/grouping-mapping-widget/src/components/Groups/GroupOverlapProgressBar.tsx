/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { GroupMinimal } from "@itwin/insights-client";
import { ProgressLinear } from "@itwin/itwinui-react";
import React from "react";
import type { OverlappedInfo } from "../context/GroupHilitedElementsContext";
import { GroupingMappingWidget } from "../../GroupingMappingWidget";

interface OverlapProgressProps {
  group: GroupMinimal;
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
      title={GroupingMappingWidget.translate("groups.overlapProgressTitle", { overlappedElements: String(overlappedElements), totalElements: String(totalElements) })}
      value={overlapPercentage}
      isAnimated
      status="negative"
    />
  );
};
