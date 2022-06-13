/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import * as React from "react";
import { createContext } from "react";

export interface ApiConfig {
  getAccessToken: () => Promise<AccessToken>;
  baseUrl: string;
}

export const ApiConfigContext = createContext<ApiConfig>({
  getAccessToken: async () => "",
  baseUrl: "",
});

export const useApiConfig = () => {
  const context = React.useContext(ApiConfigContext);
  if (!context) {
    throw new Error(
      "useApiConfig should be used within a ApiConfigContext provider"
    );
  }
  return context;
};
