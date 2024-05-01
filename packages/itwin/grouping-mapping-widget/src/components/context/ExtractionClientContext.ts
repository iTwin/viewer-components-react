/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IExtractionClient } from "@itwin/insights-client";
import { ExtractionClient, REPORTING_BASE_PATH } from "@itwin/insights-client";
import { createContext, useContext } from "react";
import type { ClientPrefix } from "./GroupingApiConfigContext";

const prefixUrl = (baseUrl?: string, prefix?: string) => {
  if (prefix && baseUrl) {
    return baseUrl.replace("api.bentley.com", `${prefix}-api.bentley.com`);
  }
  return baseUrl;
};

export const createDefaultExtractionClient = (prefix?: ClientPrefix): IExtractionClient => {
  const url = prefixUrl(REPORTING_BASE_PATH, prefix);
  return new ExtractionClient(url);
};

export const createExtractionClient = (clientProp: IExtractionClient | ClientPrefix) => {
  if (undefined === clientProp || typeof clientProp === "string") {
    return createDefaultExtractionClient(clientProp as ClientPrefix);
  }
  return clientProp;
};

export const ExtractionClientContext = createContext<IExtractionClient>(createDefaultExtractionClient());

export const useExtractionClient = () => {
  const context = useContext(ExtractionClientContext);
  if (!context) {
    throw new Error(
      "useExtractionClient should be used within a ExtractionClientContext provider"
    );
  }
  return context;
};
