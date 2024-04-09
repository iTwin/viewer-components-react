/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IPropertiesClient } from "@itwin/insights-client";
import { GROUPING_AND_MAPPING_BASE_PATH, PropertiesClient } from "@itwin/insights-client";
import { createContext, useContext } from "react";
import type { ClientPrefix } from "./GroupingApiConfigContext";

const prefixUrl = (baseUrl?: string, prefix?: string) => {
  if (prefix && baseUrl) {
    return baseUrl.replace("api.bentley.com", `${prefix}-api.bentley.com`);
  }
  return baseUrl;
};

export const createDefaultPropertiesClient = (prefix?: ClientPrefix): IPropertiesClient => {
  const url = prefixUrl(GROUPING_AND_MAPPING_BASE_PATH, prefix);
  return new PropertiesClient(undefined, url);
};

export const createPropertiesClient = (clientProp: IPropertiesClient | ClientPrefix) => {
  if (undefined === clientProp || typeof clientProp === "string") {
    return createDefaultPropertiesClient(clientProp as ClientPrefix);
  }
  return clientProp;
};

export const PropertiesClientContext = createContext<IPropertiesClient>(createDefaultPropertiesClient());

export const usePropertiesClient = () => {
  const context = useContext(PropertiesClientContext);
  if (!context) {
    throw new Error(
      "useGroupsClient should be used within a GroupsClientContext provider"
    );
  }
  return context;
};
