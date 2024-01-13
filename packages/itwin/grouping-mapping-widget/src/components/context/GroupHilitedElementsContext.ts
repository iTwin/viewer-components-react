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

export interface GroupHilitedElements {
  // hilitedElementsQueryCache: MutableRefObject<Map<string, QueryCacheItem>>;
  hiddenGroupsIds: Set<string>;
  showGroupColor: boolean;
  currentHilitedGroups: number;
  overlappedElementsInfo: Map<string, OverlappedInfo[]>;
  groupElementsInfo: Map<string, number>;
  isVisualizationsEnabled: boolean;
  isOverlappedColored: boolean;
  overlappedElementGroupPairs: OverlappedElementGroupPairs[];
  setHiddenGroupsIds: (hiddenGroupIds: Set<string>) => void;
  setShowGroupColor: (showGroupColor: boolean | ((showGroupColor: boolean) => boolean)) => void;
  setNumberOfVisualizedGroups: (numberOfVisualizedGroups: number | ((numberOfVisualizedGroups: number) => number)) => void;
  setOverlappedElementsInfo: (overlappedElementsInfo: Map<string, OverlappedInfo[]> | ((overlappedElementsInfo: Map<string, OverlappedInfo[]>) => Map<string, OverlappedInfo[]>)) => void;
  setGroupElementsInfo: (groupElementsInfo: Map<string, number> | ((groupElementsInfo: Map<string, number>) => Map<string, number>)) => void;
  setIsOverlappedColored: (isOverlappedColored: boolean | ((isOverlappedColored: boolean) => boolean)) => void;
  setOverlappedElementGroupPairs: (overlappedElementGroupPairs: OverlappedElementGroupPairs[]) => void;
  setIsVisualizationsEnabled: (isVisualizationsEnabled: boolean | ((isVisualizationsEnabled: boolean) => boolean)) => void;
}

export const GroupHilitedElementsContext = React.createContext<GroupHilitedElements>({
  // hilitedElementsQueryCache: { current: new Map() },
  hiddenGroupsIds: new Set(),
  showGroupColor: false,
  currentHilitedGroups: 0,
  overlappedElementsInfo: new Map(),
  isVisualizationsEnabled: false,
  groupElementsInfo: new Map(),
  isOverlappedColored: false,
  overlappedElementGroupPairs: [],
  setHiddenGroupsIds: () => { },
  setShowGroupColor: () => { },
  setNumberOfVisualizedGroups: () => { },
  setOverlappedElementsInfo: () => { },
  setGroupElementsInfo: () => { },
  setIsOverlappedColored: () => { },
  setOverlappedElementGroupPairs: () => { },
  setIsVisualizationsEnabled: () => { },
});

export const useGroupHilitedElementsContext = (): GroupHilitedElements => {
  const context = React.useContext(GroupHilitedElementsContext);
  if (!context) {
    throw new Error(
      "useGroupHilitedElementsContext should be used within a GroupHilitedElementsContext provider"
    );
  }
  return context;
};
