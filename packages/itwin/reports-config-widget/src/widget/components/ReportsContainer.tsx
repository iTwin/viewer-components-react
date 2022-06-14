/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import * as React from "react";
import { Reports } from "../components/Reports";
import { ReportsApiConfigContext } from "../context/ReportsApiConfigContext";
import "./ReportsContainer.scss";

interface ReportsContainerProps {
  getAccessToken?: () => Promise<AccessToken>;
  baseUrl: string;
}

const ReportsContainer = ({
  getAccessToken,
  baseUrl,
}: ReportsContainerProps) => (
  <ReportsApiConfigContext.Provider
    value={{
      getAccessToken:
        getAccessToken ??
        (async () =>
          (await IModelApp.authorizationClient?.getAccessToken()) ?? ""),
      baseUrl,
    }}
  >
    <div className="reports-container">
      <Reports />
    </div>
  </ReportsApiConfigContext.Provider>
);

export default ReportsContainer;
