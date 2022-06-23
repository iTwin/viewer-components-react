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
import { createDefaultMappingClient, MappingClientContext } from "./context/MappingClientContext";

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
  const [mappingClient, setMappingClient] = useState<IMappingClient>(createDefaultMappingClient());
  const [apiConfig, setApiConfig] = useState<GroupingMappingApiConfig>({
    getAccessToken: getAccessToken ?? authorizationClientGetAccessToken,
    prefix,
  });

  useEffect(() => {
    setApiConfig(() => ({ prefix, getAccessToken: getAccessToken ?? authorizationClientGetAccessToken }));
  }, [getAccessToken, prefix]);

  const clientProp: IMappingClient | ClientPrefix = client ?? prefix;
  useEffect(() => {
    if (undefined === clientProp || typeof clientProp === "string") {
      setMappingClient(createDefaultMappingClient(clientProp as ClientPrefix));
    } else {
      setMappingClient(clientProp);
    }
  }, [clientProp]);

  return (
    <GroupingMappingApiConfigContext.Provider
      value={apiConfig}
    >
      <MappingClientContext.Provider value={mappingClient}>
        <div className='group-mapping-container'>
          <Mappings />
        </div>
      </MappingClientContext.Provider>
    </GroupingMappingApiConfigContext.Provider>
  );
};

export default GroupingMapping;
