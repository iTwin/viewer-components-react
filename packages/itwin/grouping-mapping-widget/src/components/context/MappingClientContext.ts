/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IMappingsClient} from "@itwin/insights-client";
import { MappingsClient, REPORTING_BASE_PATH } from "@itwin/insights-client";
import { createContext, useContext } from "react";
import type { ClientPrefix } from "./GroupingApiConfigContext";

const prefixUrl = (baseUrl?: string, prefix?: string) => {
  if (prefix && baseUrl) {
    return baseUrl.replace("api.bentley.com", `${prefix}-api.bentley.com`);
  }
  return baseUrl;
};

export const createDefaultMappingClient = (prefix?: ClientPrefix): IMappingsClient => {
  const url = prefixUrl(REPORTING_BASE_PATH, prefix);
  return new MappingsClient(url);
};

export const createMappingClient = (clientProp: IMappingsClient | ClientPrefix) => {
  if (undefined === clientProp || typeof clientProp === "string") {
    return createDefaultMappingClient(clientProp as ClientPrefix);
  }
  return clientProp;
};
export const MappingClientContext = createContext<IMappingsClient>(createDefaultMappingClient());

export const useMappingClient = () => {
  const context = useContext(MappingClientContext);
  if (!context) {
    throw new Error(
      "useMappingClient should be used within a MappingClientContext provider"
    );
  }
  return context;
};
