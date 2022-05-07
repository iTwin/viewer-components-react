/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import * as React from "react";
import { useEffect, useState } from "react";
import { Reports } from "../components/Reports";
import { ApiContext } from "../context/ApiContext";
import "./ReportsContainer.scss";

interface ReportsContainerProps {
  accessToken?: AccessToken;
  baseUrl: string;
}

const ReportsContainer = ({ accessToken, baseUrl }: ReportsContainerProps) => {
  const [currentAccessToken, setCurrentAccessToken] = useState<string>("");

  useEffect(() => {
    const fetchAccessToken = async () => {
      const token = accessToken ?? (await IModelApp.authorizationClient?.getAccessToken() ?? "");
      setCurrentAccessToken(token);
    };
    void fetchAccessToken();
  }, [accessToken, setCurrentAccessToken]);

  return (
    currentAccessToken ? <ApiContext.Provider value={{ accessToken: currentAccessToken, baseUrl }}>
      <div className='reports-container'>
        <Reports />
      </div>
    </ApiContext.Provider> : null
  );
};

export default ReportsContainer;
