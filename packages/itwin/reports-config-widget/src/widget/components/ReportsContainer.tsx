/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import * as React from "react";
import { createContext, useEffect, useState } from "react";
import { Reports } from "./Reports";
import "./ReportsContainer.scss";

export interface Api {
  accessToken: AccessToken;
  prefix?: "" | "dev" | "qa";
}

export const ApiContext = createContext<Api>({ accessToken: "" });

interface ReportsContainerProps {
  accessToken?: AccessToken;
  prefix?: "" | "dev" | "qa";
}


const ReportsContainer = ({ accessToken, prefix }: ReportsContainerProps) => {
  const [currentAccessToken, setCurrentAccessToken] = useState<string>("");

  useEffect(() => {
    const fetchAccessToken = async () => {
      const token = accessToken ?? (await IModelApp.authorizationClient?.getAccessToken() ?? "");
      setCurrentAccessToken(token);
    };
    void fetchAccessToken();
  }, [accessToken, setCurrentAccessToken]);

  return (
    currentAccessToken ? <ApiContext.Provider value={{ accessToken: currentAccessToken, prefix }}>
      <div className='reports-container'>
        <Reports />
      </div>
    </ApiContext.Provider> : null
  );
};

export default ReportsContainer;
