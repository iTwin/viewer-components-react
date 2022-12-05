/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import { createReportsClient, ReportsClientContext } from "./api/context/ReportsClientContext";
import type { EC3Config } from "./EC3/EC3Config";
import Templates from "./Templates";
import { createODataClient, ODataClientContext } from "./api/context/ODataClientContext";
import { createEC3JobsClient, EC3JobsClientContext } from "./api/context/EC3JobsClientContext";
import { createEC3ConfigurationsClient, EC3ConfigurationsClientContext } from "./api/context/EC3ConfigurationsClientContext";
import { AccessTokenFnContext } from "./api/context/AccessTokenFnContext";

export interface EC3Props {
  config: EC3Config;
}

const EC3 = ({ config }: EC3Props) => {
  return (
    <AccessTokenFnContext.Provider value={config.getAccessToken}>
      <ReportsClientContext.Provider value={createReportsClient(config.reportingBasePath)}>
        <ODataClientContext.Provider value={createODataClient(config.reportingBasePath)}>
          <EC3JobsClientContext.Provider value={createEC3JobsClient(config.carbonCalculationBasePath)}>
            <EC3ConfigurationsClientContext.Provider value={createEC3ConfigurationsClient(config.carbonCalculationBasePath)}>
              <div className="ec3w-container">
                <Templates
                  config={config} />
              </div>
            </EC3ConfigurationsClientContext.Provider>
          </EC3JobsClientContext.Provider>
        </ODataClientContext.Provider>
      </ReportsClientContext.Provider>
    </AccessTokenFnContext.Provider>
  );
};

export default EC3;
