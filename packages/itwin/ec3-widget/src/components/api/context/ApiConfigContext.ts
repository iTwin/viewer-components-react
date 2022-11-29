/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import * as React from "react";
import { createContext } from "react";

export type ClientPrefix = "" | "dev" | "qa" | undefined;
export type GetAccessTokenFn = () => Promise<AccessToken>;
export interface ApiConfig {
  getAccessToken: GetAccessTokenFn;
  prefix?: ClientPrefix;
}

export const ApiConfigContext =
  createContext<ApiConfig>({
    getAccessToken: async () => "",
    prefix: undefined,
  });

export const useApiConfig = () => {
  const context = React.useContext(ApiConfigContext);
  if (!context) {
    throw new Error(
      "useGroupingMappingApiConfig should be used within a ApiConfigContext provider"
    );
  }
  return context;
};
