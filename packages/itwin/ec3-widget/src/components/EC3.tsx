/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useEffect, useState } from "react";
import { createReportsClient, ReportsClientContext } from "./api/context/ReportsClientContext";
import type { EC3Config } from "./EC3/EC3Config";
import Templates from "./Templates";
import type { IEC3ConfigurationsClient, IEC3JobsClient, IOdataClient, IReportsClient } from "@itwin/insights-client";
import { createODataClient, ODataClientContext } from "./api/context/ODataClientContext";
import { createEC3JobsClient, EC3JobsClientContext } from "./api/context/EC3JobsClientContext";
import { createEC3ConfigurationsClient, EC3ConfigurationsClientContext } from "./api/context/EC3ConfigurationsClientContext";
import type { ApiConfig } from "./api/context/ApiConfigContext";
import { ApiConfigContext } from "./api/context/ApiConfigContext";
import { IModelApp } from "@itwin/core-frontend";

export interface EC3Props {
  config: EC3Config;
}

const authorizationClientGetAccessToken = async () =>
  (await IModelApp.authorizationClient?.getAccessToken()) ?? "";

const EC3 = ({ config }: EC3Props) => {
  const [reportsClient, setReportsClient] = useState<IReportsClient>(createReportsClient(config.prefix));
  const [oDataClient, setODataClient] = useState<IOdataClient>(createODataClient(config.prefix));
  const [ec3JobsClient, setEC3JobsClient] = useState<IEC3JobsClient>(createEC3JobsClient(config.prefix));
  const [ec3ConfigurationsClient, setEC3ConfigurationsClient] = useState<IEC3ConfigurationsClient>(createEC3ConfigurationsClient(config.prefix));
  const [apiConfig, setApiConfig] = useState<ApiConfig>({
    getAccessToken: config.getAccessToken ?? authorizationClientGetAccessToken,
    prefix: config.prefix,
  });

  useEffect(() => {
    setReportsClient(createReportsClient(config.prefix));
    setODataClient(createODataClient(config.prefix));
    setEC3JobsClient(createEC3JobsClient(config.prefix));
    setEC3ConfigurationsClient(createEC3ConfigurationsClient(config.prefix));
    setApiConfig(() => ({
      prefix: config.prefix,
      getAccessToken: config.getAccessToken ?? authorizationClientGetAccessToken,
    }));
  }, [config.prefix, config.getAccessToken]);

  return (
    <ApiConfigContext.Provider value={apiConfig}>
      <ReportsClientContext.Provider value={reportsClient}>
        <ODataClientContext.Provider value={oDataClient}>
          <EC3JobsClientContext.Provider value={ec3JobsClient}>
            <EC3ConfigurationsClientContext.Provider value={ec3ConfigurationsClient}>
              <div className="ec3w-container">
                <Templates
                  config={config} />
              </div>
            </EC3ConfigurationsClientContext.Provider>
          </EC3JobsClientContext.Provider>
        </ODataClientContext.Provider>
      </ReportsClientContext.Provider>
    </ApiConfigContext.Provider>
  );
};

export default EC3;
