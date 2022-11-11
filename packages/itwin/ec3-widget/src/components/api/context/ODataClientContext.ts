/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IOdataClient } from "@itwin/insights-client";
import { ODataClient, REPORTING_BASE_PATH } from "@itwin/insights-client";
import { createContext, useContext } from "react";

const prefixUrl = (prefix: string) => {
  return REPORTING_BASE_PATH.replace("api.bentley.com", `${prefix}-api.bentley.com`);
};

export const createDefaultODataClient = (prefix?: string): IOdataClient => {
  const url = prefixUrl(prefix ?? "");
  return new ODataClient(url);
};

export const createODataClient = (prefix?: string) => {
  return createDefaultODataClient(prefix);
};

export const ODataClientContext = createContext<IOdataClient>(createDefaultODataClient());

export const useODataClient = () => {
  const context = useContext(ODataClientContext);
  if (!context) {
    throw new Error(
      "useODataClient should be used within a ODataClientContext provider"
    );
  }
  return context;
};
