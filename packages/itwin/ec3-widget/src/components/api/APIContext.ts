/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import type { IEC3ConfigurationsClient, IEC3JobsClient, IOdataClient, IReportsClient} from "@itwin/insights-client";
import { EC3ConfigurationsClient, EC3JobsClient, ODataClient, ReportsClient } from "@itwin/insights-client";
import { createContext, useContext } from "react";
import { EC3Config } from "../EC3/EC3Config";

export type GetAccessTokenFn = () => Promise<AccessToken>;

interface EC3ApiContext {
  reportsClient: IReportsClient;
  oDataClient: IOdataClient;
  ec3JobsClient: IEC3JobsClient;
  ec3ConfigurationsClient: IEC3ConfigurationsClient;
  getAccessTokenFn: GetAccessTokenFn;
}

export const createApiContext = (config: EC3Config) => {
  return {
    reportsClient: new ReportsClient(config.reportingBasePath),
    oDataClient: new ODataClient(config.reportingBasePath),
    ec3JobsClient: new EC3JobsClient(config.carbonCalculationBasePath),
    ec3ConfigurationsClient: new EC3ConfigurationsClient(config.carbonCalculationBasePath),
    getAccessTokenFn: config.getAccessToken,
  };
};

export const ApiContext = createContext<EC3ApiContext>(createApiContext(new EC3Config({
  clientId: "",
  redirectUri: "",
})));

export const useApiContext = () => {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error(
      "useAPIContext should be used within an APIContext provider"
    );
  }
  return context;
};
