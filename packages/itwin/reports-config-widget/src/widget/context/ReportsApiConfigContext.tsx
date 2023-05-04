/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import * as React from "react";
import { createContext } from "react";

export type GetAccessTokenFn = () => Promise<AccessToken>;

export interface ReportsApiConfig {
  getAccessToken: GetAccessTokenFn;
  iTwinId: string;
  iModelId: string;
  baseUrl: string;
}

export const ReportsApiConfigContext = createContext<ReportsApiConfig>({
  getAccessToken: async () => "",
  baseUrl: "",
  iTwinId: "",
  iModelId: "",
});

export const useReportsApiConfig = () => {
  const context = React.useContext(ReportsApiConfigContext);
  if (!context) {
    throw new Error(
      "useApiConfig should be used within a ReportsApiConfigContext provider"
    );
  }
  return context;
};
