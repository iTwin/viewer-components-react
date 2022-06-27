/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { REPORTING_BASE_PATH, ReportingClient } from "@itwin/insights-client";
import { createContext, useContext } from "react";
import type { IMappingClient } from "../../IMappingClient";
import type { ClientPrefix } from "./GroupingApiConfigContext";

const prefixUrl = (baseUrl?: string, prefix?: string) => {
  if (prefix && baseUrl) {
    return baseUrl.replace("api.bentley.com", `${prefix}-api.bentley.com`);
  }
  return baseUrl;
};

export const createDefaultMappingClient = (prefix?: ClientPrefix): IMappingClient => {
  const url = prefixUrl(REPORTING_BASE_PATH, prefix);
  return new ReportingClient(url);
};

export const MappingClientContext = createContext<IMappingClient>(createDefaultMappingClient());

export const useMappingClient = () => {
  const context = useContext(MappingClientContext);
  if (!context) {
    throw new Error(
      "useMappingClient should be used within a MappingClientContext provider"
    );
  }
  return context;
};
