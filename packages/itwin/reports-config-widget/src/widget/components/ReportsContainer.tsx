/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AccessToken } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import * as React from "react";
import { createContext, useEffect, useState } from "react";
import { Reports } from "./Reports";
import "./ReportsContainer.scss";

export const AccessTokenContext = createContext<string>("");

interface ReportsContainerProps {
  accessToken?: AccessToken;
}

const ReportsContainer = ({ accessToken }: ReportsContainerProps) => {
  const [currentAccessToken, setCurrentAccessToken] = useState<string>("")

  useEffect(() => {
    const fetchAccessToken = async () => {
      const token = accessToken ?? (await IModelApp.authorizationClient?.getAccessToken() ?? "")
      setCurrentAccessToken(token)
    }
    fetchAccessToken();
  }, [accessToken, setCurrentAccessToken])

  return (
    currentAccessToken ? <AccessTokenContext.Provider value={currentAccessToken}>
      <div className='reports-container'>
        <Reports />
      </div>
    </AccessTokenContext.Provider> : null
  );
};

export default ReportsContainer;
