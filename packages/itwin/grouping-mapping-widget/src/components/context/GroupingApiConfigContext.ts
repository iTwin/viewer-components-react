/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import * as React from "react";
import { createContext } from "react";

export type ClientPrefix = "" | "dev" | "qa" | undefined;
export type GetAccessTokenFn = () => Promise<AccessToken>;
export interface GroupingMappingApiConfig {
  getAccessToken: GetAccessTokenFn;
  iModelId: string;
  iModelConnection?: IModelConnection;
  prefix?: ClientPrefix;
}

export const GroupingMappingApiConfigContext =
  createContext<GroupingMappingApiConfig>({
    getAccessToken: async () => "",
    iModelId: "",
    prefix: undefined,
    iModelConnection: undefined,
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
