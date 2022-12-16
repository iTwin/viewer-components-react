/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import type { MutableRefObject } from "react";
import type { Group } from "@itwin/insights-client";

export interface GroupHilitedElements {
  hilitedElementsQueryCache: MutableRefObject<Map<string, string[]>>;
  hiddenGroupsIds: string[];
  showGroupColor: boolean;
  groups: Group[];
  setGroups: (groups: Group[] | ((groups: Group[]) => Group[])) => void;
  setHiddenGroupsIds: (hiddenGroupIds: string[] | ((hiddenGroupIds: string[]) => string[])) => void;
  setShowGroupColor: (showGroupColor: boolean | ((showGroupColor: boolean) => boolean)) => void;
}

export const GroupHilitedElementsContext = React.createContext<GroupHilitedElements>({
  hilitedElementsQueryCache: { current: new Map() },
  hiddenGroupsIds: [],
  showGroupColor: false,
  groups: [],
  setGroups: (groups)=> groups,
  setHiddenGroupsIds: (hiddenGroupIds) => hiddenGroupIds,
  setShowGroupColor: (showGroupColor) => showGroupColor,
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
