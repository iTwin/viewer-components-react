/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { createContext, useEffect, useState } from "react";
import { Mappings } from "./Mapping";
import "./GroupingMapping.scss";
import type { AccessToken } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import type { IMappingClient } from "../IMappingClient";
import { REPORTING_BASE_PATH, ReportingClient } from "@itwin/insights-client";

export interface Api {
  accessToken: AccessToken;
  prefix?: ClientPrefix;
}

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

export const ApiContext = createContext<Api>({ accessToken: "", prefix: undefined });

export const MappingClientContext = createContext<IMappingClient>(createDefaultMappingClient());

export type ClientPrefix = "" | "dev" | "qa" | undefined;

interface GroupingMappingProps {
  accessToken?: AccessToken;
  /**
   * Used for iTwin and iModel APIs.
   * Also used for Mapping API if a custom {@link client} is not provided.
   */
  prefix?: ClientPrefix;
  /**
   * A custom implementation of MappingClient.
   */
  client?: IMappingClient;
}

const GroupingMapping = ({ accessToken, prefix, client }: GroupingMappingProps) => {
  const [currentAccessToken, setCurrentAccessToken] = useState<string>("");
  const [mappingClient, setMappingClient] = useState<IMappingClient>(createDefaultMappingClient());

  useEffect(() => {
    // If no access token is provided, fetch it from session
    const fetchAccessToken = async () => {
      const token = accessToken ?? (await IModelApp.authorizationClient?.getAccessToken() ?? "");
      setCurrentAccessToken(token);
    };
    void fetchAccessToken();
  }, [accessToken, setCurrentAccessToken]);

  const clientProp: IMappingClient | ClientPrefix = client ?? prefix;
  useEffect(() => {
    if (undefined === clientProp || typeof clientProp === "string") {
      setMappingClient(createDefaultMappingClient(clientProp as ClientPrefix));
    } else {
      setMappingClient(clientProp);
    }
  }, [clientProp]);

  return (
    currentAccessToken ? <ApiContext.Provider value={{ accessToken: currentAccessToken, prefix }}>
      <MappingClientContext.Provider value={mappingClient}>
        <div className='group-mapping-container'>
          <Mappings />
        </div>
      </MappingClientContext.Provider>
    </ApiContext.Provider> : null
  );
};

export default GroupingMapping;
