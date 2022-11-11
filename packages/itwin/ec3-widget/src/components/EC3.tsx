/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useEffect, useState } from "react";
import { createReportsClient, ReportsClientContext } from "./api/context/ReportsClientContext";
import type { EC3Config } from "./EC3/EC3Config";
import Templates from "./Templates";
import type { IOdataClient, IReportsClient } from "@itwin/insights-client";
import "./Templates.scss";
import { createODataClient, ODataClientContext } from "./api/context/ODataClientContext";
import { createEC3JobClient, EC3JobClientContext } from "./api/context/EC3JobClientContext";
import { createEC3ConfigurationClient, EC3ConfigurationClientContext } from "./api/context/EC3ConfigurationClientContext";
import type { EC3JobClient } from "./api/EC3JobClient";
import type { EC3ConfigurationClient } from "./api/EC3ConfigurationClient";

export interface EC3Props {
  config: EC3Config;
}

const EC3 = ({ config }: EC3Props) => {
  const [reportsClient, setReportsClient] = useState<IReportsClient>(createReportsClient(config.prefix));
  const [oDataClient, setODataClient] = useState<IOdataClient>(createODataClient(config.prefix));
  const [ec3JobClient, setEC3JobClient] = useState<EC3JobClient>(createEC3JobClient(config.prefix));
  const [ec3ConfigurationClient, setEC3ConfigurationClient] = useState<EC3ConfigurationClient>(createEC3ConfigurationClient(config.prefix));

  useEffect(() => {
    setReportsClient(createReportsClient(config.prefix));
    setODataClient(createODataClient(config.prefix));
    setEC3JobClient(createEC3JobClient(config.prefix));
    setEC3ConfigurationClient(createEC3ConfigurationClient(config.prefix));
  }, [config.prefix]);

  return (
    <ReportsClientContext.Provider value={reportsClient}>
      <ODataClientContext.Provider value={oDataClient}>
        <EC3JobClientContext.Provider value={ec3JobClient}>
          <EC3ConfigurationClientContext.Provider value={ec3ConfigurationClient}>
            <div className="ec3w-container">
              <Templates
                config={config} />
            </div>
          </EC3ConfigurationClientContext.Provider>
        </EC3JobClientContext.Provider>
      </ODataClientContext.Provider>
    </ReportsClientContext.Provider>
  );
};

export default EC3;
