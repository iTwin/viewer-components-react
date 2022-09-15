/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { createContext, useContext } from "react";
import type { GroupingMappingUIProvider } from "../provider/GroupingMappingUIProvider";

export const createGroupingMappingProvider = (
  providers: GroupingMappingUIProvider[] | undefined,
): GroupingMappingUIProvider[] => {
  if (undefined === providers) {
    return [];
  }
  return providers;
};

export const GroupingMappingUIProviderContext = createContext<GroupingMappingUIProvider[]>([]);

export const useGroupingMappingUIProvider = () => {
  const context = useContext(GroupingMappingUIProviderContext);
  if (!context) {
    throw new Error(
      "useGroupingMappingUIProvider should be used within a GroupingMappingUIProviderContext provider",
    );
  }
  return context;
};
