/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
export interface OverlappedInfo {
  groupIds: string[];
  elements: string[];
}

export interface OverlappedElementGroupPairs {
  elementIds: Set<string>;
  groupIds: Set<string>;
}

export interface OverlappedElementsMetadata {
  overlappedElementsInfo: Map<string, OverlappedInfo[]>;
  groupElementsInfo: Map<string, number>;
  overlappedElementGroupPairs: OverlappedElementGroupPairs[];
}
export interface GroupHilitedElements {
  hiddenGroupsIds: Set<string>;
  showGroupColor: boolean;
  currentHilitedGroups: number;
  overlappedElementsMetadata: OverlappedElementsMetadata;
  isVisualizationsEnabled: boolean;
  isOverlappedColored: boolean;
  setHiddenGroupsIds: (hiddenGroupIds: Set<string>) => void;
  setShowGroupColor: (showGroupColor: boolean | ((showGroupColor: boolean) => boolean)) => void;
  setNumberOfVisualizedGroups: (numberOfVisualizedGroups: number | ((numberOfVisualizedGroups: number) => number)) => void;
  setOverlappedElementsMetadata: (overlappedElementsMetaData: OverlappedElementsMetadata) => void;
  setIsOverlappedColored: (isOverlappedColored: boolean | ((isOverlappedColored: boolean) => boolean)) => void;
  setIsVisualizationsEnabled: (isVisualizationsEnabled: boolean | ((isVisualizationsEnabled: boolean) => boolean)) => void;
}

export const GroupHilitedElementsContext = React.createContext<GroupHilitedElements>({
  hiddenGroupsIds: new Set(),
  showGroupColor: false,
  currentHilitedGroups: 0,
  overlappedElementsMetadata: {
    overlappedElementsInfo: new Map(),
    groupElementsInfo: new Map(),
    overlappedElementGroupPairs: [],
  },
  isVisualizationsEnabled: false,
  isOverlappedColored: false,
  setHiddenGroupsIds: () => {},
  setShowGroupColor: () => {},
  setNumberOfVisualizedGroups: () => {},
  setOverlappedElementsMetadata: () => {},
  setIsOverlappedColored: () => {},
  setIsVisualizationsEnabled: () => {},
});

export const useGroupHilitedElementsContext = (): GroupHilitedElements => {
  const context = React.useContext(GroupHilitedElementsContext);
  if (!context) {
    throw new Error("useGroupHilitedElementsContext should be used within a GroupHilitedElementsContext provider");
  }
  return context;
};
