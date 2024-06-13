/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import { IModelsClient } from "@itwin/imodels-client-management";
import type { IMappingsClient, IReportsClient } from "@itwin/insights-client";
import { MappingsClient, ReportsClient } from "@itwin/insights-client";
import * as React from "react";
import { createContext } from "react";

export type GetAccessTokenFn = () => Promise<AccessToken>;

export interface ReportsConfigApiProps {
  getAccessToken: GetAccessTokenFn;
  iTwinId: string;
  baseUrl: string;
  reportsClient: IReportsClient;
  mappingsClient: IMappingsClient;
  iModelsClient: IModelsClient;
}

export const ReportsConfigApiContext = createContext<ReportsConfigApiProps>({
  getAccessToken: async () => "",
  iTwinId: "",
  baseUrl: "",
  reportsClient: new ReportsClient(),
  mappingsClient: new MappingsClient(),
  iModelsClient: new IModelsClient(),
});

export const useReportsConfigApi = () => {
  const context = React.useContext(ReportsConfigApiContext);
  if (!context) {
    throw new Error("useReportsConfigApi should be used within a ReportsConfigApiContext provider");
  }
  return context;
};
