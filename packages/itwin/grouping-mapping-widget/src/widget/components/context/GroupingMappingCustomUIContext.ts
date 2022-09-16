/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { createContext, useContext } from "react";
import type { GroupingMappingCustomUI } from "../customUI/GroupingMappingCustomUI";

export const createGroupingMappingCustomUI = (
  customUIs: GroupingMappingCustomUI[] | undefined,
): GroupingMappingCustomUI[] => {
  if (undefined === customUIs) {
    return [];
  }
  return customUIs;
};

export const GroupingMappingCustomUIContext = createContext<GroupingMappingCustomUI[]>([]);

export const useGroupingMappingCustomUI = () => {
  const context = useContext(GroupingMappingCustomUIContext);
  if (!context) {
    throw new Error(
      "useGroupingMappingCustomUI should be used within a GroupingMappingCustomUIContext provider",
    );
  }
  return context;
};
