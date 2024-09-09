/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import * as React from "react";
import { createContext } from "react";

/**
 * @public
 */
export type ClientPrefix = "" | "dev" | "qa" | undefined;

/**
 * @public
 */
export type GetAccessTokenFn = () => Promise<AccessToken>;

/**
 * @public
 */
export interface GroupingMappingApiConfig {
  getAccessToken: GetAccessTokenFn;
  iModelId: string;
  iModelConnection?: IModelConnection;
  changeSetId?: string;
  prefix?: ClientPrefix;
}

/**
 * @public
 */
export const GroupingMappingApiConfigContext = createContext<GroupingMappingApiConfig>({
  getAccessToken: async () => "",
  iModelId: "",
});

/**
 * Hook to access the GroupingMappingApiConfig from the context.
 * @public
 */
export const useGroupingMappingApiConfig = () => {
  const context = React.useContext(GroupingMappingApiConfigContext);
  if (!context) {
    throw new Error("useGroupingMappingApiConfig should be used within a GroupingMappingApiConfigContext provider");
  }
  return context;
};
