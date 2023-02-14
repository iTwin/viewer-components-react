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
  setGroups: (groups: Group[]) => void;
  setHiddenGroupsIds: (hiddenGroupIds: string[]) => void;
  setShowGroupColor: (showGroupColor: boolean) => void;
}

export const GroupHilitedElementsContext = React.createContext<GroupHilitedElements>({
  hilitedElementsQueryCache: { current: new Map() },
  hiddenGroupsIds: [],
  showGroupColor: false,
  groups: [],
  setGroups: () => { },
  setHiddenGroupsIds: () => { },
  setShowGroupColor: () => { },
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
