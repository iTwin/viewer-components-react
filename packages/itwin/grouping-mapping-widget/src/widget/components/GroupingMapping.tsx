/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useEffect, useState } from "react";
import { Mappings } from "./Mapping";
import "./GroupingMapping.scss";
import type { AccessToken } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import type { IMappingClient } from "../IMappingClient";
import type { ClientPrefix } from "./context/GroupingApiConfigContext";
import { GroupingMappingApiConfigContext } from "./context/GroupingApiConfigContext";
import { createDefaultMappingClient, MappingClientContext } from "./context/MappingClientContext";



interface GroupingMappingProps {
  getAccessToken?: () => Promise<AccessToken>;
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

const GroupingMapping = ({ getAccessToken, prefix, client }: GroupingMappingProps) => {
  const [mappingClient, setMappingClient] = useState<IMappingClient>(createDefaultMappingClient());

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
      value={{
        getAccessToken:
          getAccessToken ??
          (async () =>
            (await IModelApp.authorizationClient?.getAccessToken()) ?? ""),
        prefix,
      }}
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
