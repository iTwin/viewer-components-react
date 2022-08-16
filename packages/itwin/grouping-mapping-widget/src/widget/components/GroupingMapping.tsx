/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useEffect, useState } from "react";
import { Mappings } from "./Mapping";
import "./GroupingMapping.scss";
import { IModelApp } from "@itwin/core-frontend";
import type { IMappingClient } from "../IMappingClient";
import type { ClientPrefix, GetAccessTokenFn, GroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import { GroupingMappingApiConfigContext } from "./context/GroupingApiConfigContext";
import { createMappingClient, MappingClientContext } from "./context/MappingClientContext";

export interface GroupingMappingProps {
  /**
   * Custom callback to retrieve access token.
   */
  getAccessToken?: GetAccessTokenFn;
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

const authorizationClientGetAccessToken = (async () => (await IModelApp.authorizationClient?.getAccessToken() ?? ""));

const GroupingMapping = ({ getAccessToken, prefix, client }: GroupingMappingProps) => {
  const clientProp: IMappingClient | ClientPrefix = client ?? prefix;
  const [mappingClient, setMappingClient] = useState<IMappingClient>(createMappingClient(clientProp));
  const [apiConfig, setApiConfig] = useState<GroupingMappingApiConfig>({
    getAccessToken: getAccessToken ?? authorizationClientGetAccessToken,
    prefix,
  });

  useEffect(() => {
    setApiConfig(() => ({ prefix, getAccessToken: getAccessToken ?? authorizationClientGetAccessToken }));
  }, [getAccessToken, prefix]);

  useEffect(() => {
    setMappingClient(createMappingClient(clientProp));
  }, [clientProp]);

  return (
    <GroupingMappingApiConfigContext.Provider
      value={apiConfig}
    >
      <MappingClientContext.Provider value={mappingClient}>
        <div className='gmw-group-mapping-container'>
          <Mappings />
        </div>
      </MappingClientContext.Provider>
    </GroupingMappingApiConfigContext.Provider>
  );
};

export default GroupingMapping;
