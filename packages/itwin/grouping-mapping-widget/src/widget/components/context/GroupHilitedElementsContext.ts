/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import type { MutableRefObject } from "react";
import type { Group } from "@itwin/insights-client";
import type { KeySet } from "@itwin/presentation-common";
export interface QueryCacheItem {
  keySet: KeySet;
  ids: string[];
}
export interface GroupHilitedElements {
  hilitedElementsQueryCache: MutableRefObject<Map<string, QueryCacheItem>>;
  hiddenGroupsIds: Set<string>;
  showGroupColor: boolean;
  groups: Group[];
  numberOfVisualizedGroups: number;
  setGroups: (groups: Group[]) => void;
  setHiddenGroupsIds: (hiddenGroupIds: Set<string>) => void;
  setShowGroupColor: (showGroupColor: boolean | ((showGroupColor: boolean) => boolean)) => void;
  setNumberOfVisualizedGroups: (numberOfVisualizedGroups: number | ((numberOfVisualizedGroups: number) => number)) => void;
}

export const GroupHilitedElementsContext = React.createContext<GroupHilitedElements>({
  hilitedElementsQueryCache: { current: new Map() },
  hiddenGroupsIds: new Set(),
  showGroupColor: false,
  groups: [],
  numberOfVisualizedGroups: 0,
  setGroups: () => { },
  setHiddenGroupsIds: () => { },
  setShowGroupColor: () => { },
  setNumberOfVisualizedGroups: () => { },
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
