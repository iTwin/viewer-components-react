/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import type { IEC3ConfigurationsClient, IEC3JobsClient, IOdataClient, IReportsClient } from "@itwin/insights-client";
import { EC3ConfigurationsClient, EC3JobsClient, ODataClient, ReportsClient } from "@itwin/insights-client";
import { createContext, useContext } from "react";
import { EC3Config } from "../EC3/EC3Config";

/**
 * Get Access Token callback function
 * @public
 */
export type GetAccessTokenFn = () => Promise<AccessToken>;

/**
 * EC3 API Context
 * @beta
 */
export interface EC3ApiContext {
  reportsClient: IReportsClient;
  oDataClient: IOdataClient;
  ec3JobsClient: IEC3JobsClient;
  ec3ConfigurationsClient: IEC3ConfigurationsClient;
  config: EC3Config;
}

export const createApiContext = (config: EC3Config) => {
  return {
    reportsClient: new ReportsClient(config.reportingBasePath),
    oDataClient: new ODataClient(config.reportingBasePath),
    ec3JobsClient: new EC3JobsClient(config.carbonCalculationBasePath),
    ec3ConfigurationsClient: new EC3ConfigurationsClient(config.carbonCalculationBasePath),
    config,
  };
};

export const ApiContext = createContext<EC3ApiContext>(createApiContext(new EC3Config({
  iTwinId: "",
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
