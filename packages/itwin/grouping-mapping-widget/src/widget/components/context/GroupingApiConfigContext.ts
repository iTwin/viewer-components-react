/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import * as React from "react";
import { createContext } from "react";

export type ClientPrefix = "" | "dev" | "qa" | undefined;

export interface GroupingMappingApiConfig {
  getAccessToken: () => Promise<AccessToken>;
  prefix?: ClientPrefix;
}

export const GroupingMappingApiConfigContext =
  createContext<GroupingMappingApiConfig>({
    getAccessToken: async () => "",
    prefix: undefined,
  });

export const useGroupingMappingApiConfig = () => {
  const context = React.useContext(GroupingMappingApiConfigContext);
  if (!context) {
    throw new Error(
      "useGroupingMappingApiConfig should be used within a GroupingMappingApiConfigContext provider"
    );
  }
  return context;
};
