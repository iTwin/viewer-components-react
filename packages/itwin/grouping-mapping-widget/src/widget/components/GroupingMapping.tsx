/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useEffect, useState } from "react";
import { Mappings } from "./Mapping";
import "./GroupingMapping.scss";
import { IModelApp } from "@itwin/core-frontend";
import type {
  ClientPrefix,
  GetAccessTokenFn,
  GroupingMappingApiConfig,
} from "./context/GroupingApiConfigContext";
import { GroupingMappingApiConfigContext } from "./context/GroupingApiConfigContext";
import {
  createMappingClient,
  MappingClientContext,
} from "./context/MappingClientContext";
import type { IMappingsClient } from "@itwin/insights-client";
import { createCustomUIProvider } from "./context/CustomUIProviderContext";
import { CustomUIProviderContext } from "./context/CustomUIProviderContext";
import type { CustomUIProvider } from "../utils";

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
  client?: IMappingsClient;
  /**
   * Custom UI providers to add and update groups
   */
  uiProviders?: CustomUIProvider[];
}

const authorizationClientGetAccessToken = async () =>
  (await IModelApp.authorizationClient?.getAccessToken()) ?? "";

const GroupingMapping = ({
  getAccessToken,
  prefix,
  client,
  uiProviders,
}: GroupingMappingProps) => {
  const clientProp: IMappingsClient | ClientPrefix = client ?? prefix;
  const [mappingClient, setMappingClient] = useState<IMappingsClient>(createMappingClient(clientProp));
  const [groupUIProviders, setGroupUIProviders] = useState<CustomUIProvider[]>(
    createCustomUIProvider(uiProviders),
  );
  const [apiConfig, setApiConfig] = useState<GroupingMappingApiConfig>({
    getAccessToken: getAccessToken ?? authorizationClientGetAccessToken,
    prefix,
  });

  useEffect(() => {
    setApiConfig(() => ({
      prefix,
      getAccessToken: getAccessToken ?? authorizationClientGetAccessToken,
    }));
  }, [getAccessToken, prefix]);

  useEffect(() => {
    setMappingClient(createMappingClient(clientProp));
  }, [clientProp]);

  useEffect(() => {
    setGroupUIProviders(createCustomUIProvider(uiProviders));
  }, [uiProviders]);

  return (
    <GroupingMappingApiConfigContext.Provider value={apiConfig}>
      <MappingClientContext.Provider value={mappingClient}>
        <CustomUIProviderContext.Provider value={groupUIProviders}>
          <div className='gmw-group-mapping-container'>
            <Mappings />
          </div>
        </CustomUIProviderContext.Provider>
      </MappingClientContext.Provider>
    </GroupingMappingApiConfigContext.Provider>
  );
};

export default GroupingMapping;
