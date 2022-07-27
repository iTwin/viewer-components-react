/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import React, { useEffect, useState } from "react";
import { Reports } from "../components/Reports";
import type {
  ReportsApiConfig} from "../context/ReportsApiConfigContext";
import {
  ReportsApiConfigContext,
} from "../context/ReportsApiConfigContext";
import "./ReportsContainer.scss";

interface ReportsContainerProps {
  getAccessToken?: () => Promise<AccessToken>;
  baseUrl: string;
}

const authorizationClientGetAccessToken = async () =>
  (await IModelApp.authorizationClient?.getAccessToken()) ?? "";

const ReportsContainer = ({
  getAccessToken,
  baseUrl,
}: ReportsContainerProps) => {
  const [apiConfig, setApiConfig] = useState<ReportsApiConfig>({
    getAccessToken: getAccessToken ?? authorizationClientGetAccessToken,
    baseUrl,
  });

  useEffect(() => {
    setApiConfig(() => ({
      baseUrl,
      getAccessToken: getAccessToken ?? authorizationClientGetAccessToken,
    }));
  }, [getAccessToken, baseUrl]);

  return (
    <ReportsApiConfigContext.Provider value={apiConfig}>
      <div className="reports-container">
        <Reports />
      </div>
    </ReportsApiConfigContext.Provider>
  );
};

export default ReportsContainer;
