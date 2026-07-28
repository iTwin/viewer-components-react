/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { createContext, useContext } from "react";
import type { GroupingMappingCustomUI } from "../customUI/GroupingMappingCustomUI";

export const createGroupingMappingCustomUI = (customUIs: GroupingMappingCustomUI[] | undefined): GroupingMappingCustomUI[] => {
  return customUIs ?? [];
};

export interface IGroupingMappingCustomUI {
  customUIs: GroupingMappingCustomUI[];
  setCustomUIs: (customUI: GroupingMappingCustomUI[] | ((customUI: GroupingMappingCustomUI[]) => GroupingMappingCustomUI[])) => void;
}

export const GroupingMappingCustomUIContext = createContext<IGroupingMappingCustomUI>({
  customUIs: [],
  setCustomUIs: () => {},
});

export const useGroupingMappingCustomUI = () => {
  const context = useContext(GroupingMappingCustomUIContext);
  if (!context) {
    throw new Error("useGroupingMappingCustomUI should be used within a GroupingMappingCustomUIContext provider");
  }
  return context;
};
