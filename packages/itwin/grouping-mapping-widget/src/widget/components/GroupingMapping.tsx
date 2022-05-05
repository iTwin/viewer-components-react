/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { createContext, useEffect, useState } from "react";
import { Mappings } from "./Mapping";
import "./GroupingMapping.scss";
import type { AccessToken } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";

export interface Api {
  accessToken: AccessToken;
  prefix?: "" | "dev" | "qa";
}

export const ApiContext = createContext<Api>({ accessToken: "" });

interface GroupingMappingProps {
  accessToken?: AccessToken;
  prefix?: "" | "dev" | "qa";
}

const GroupingMapping = ({ accessToken, prefix }: GroupingMappingProps) => {
  const [currentAccessToken, setCurrentAccessToken] = useState<string>("");

  useEffect(() => {
    // If no access token is provided, fetch it from session
    const fetchAccessToken = async () => {
      const token = accessToken ?? (await IModelApp.authorizationClient?.getAccessToken() ?? "");
      setCurrentAccessToken(token);
    };
    void fetchAccessToken();
  }, [accessToken, setCurrentAccessToken]);

  return (
    currentAccessToken ? <ApiContext.Provider value={{ accessToken: currentAccessToken, prefix }}>
      <div className='group-mapping-container'>
        <Mappings />
      </div>
    </ApiContext.Provider> : null
  );
};

export default GroupingMapping;
