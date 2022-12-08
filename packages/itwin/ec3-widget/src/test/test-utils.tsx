/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { EC3ConfigurationsClient, EC3JobsClient, ODataClient, ReportsClient } from "@itwin/insights-client";
import { render } from "@testing-library/react";
import React from "react";
import { AccessTokenFnContext, GetAccessTokenFn } from "../components/api/context/AccessTokenFnContext";
import { EC3ConfigurationsClientContext } from "../components/api/context/EC3ConfigurationsClientContext";
import { EC3JobsClientContext } from "../components/api/context/EC3JobsClientContext";
import { ODataClientContext } from "../components/api/context/ODataClientContext";
import { ReportsClientContext } from "../components/api/context/ReportsClientContext";

export interface RenderParameters {
  component: React.ReactNode,
  ec3ConfigurationsClient?: EC3ConfigurationsClient,
  ec3JobsClient?: EC3JobsClient,
  reportsClient?: ReportsClient,
  oDataClient?: ODataClient,
  getAccessTokenFn?: GetAccessTokenFn
}

export function renderWithContext({
  component, ec3ConfigurationsClient, ec3JobsClient, reportsClient, oDataClient, getAccessTokenFn
}: RenderParameters) {
  render(
    <EC3ConfigurationsClientContext.Provider value={ec3ConfigurationsClient ?? new EC3ConfigurationsClient()}>
      <EC3JobsClientContext.Provider value={ec3JobsClient ?? new EC3JobsClient()}>
        <ReportsClientContext.Provider value={reportsClient ?? new ReportsClient()}>
          <ODataClientContext.Provider value={oDataClient ?? new ODataClient()}>
            <AccessTokenFnContext.Provider value={getAccessTokenFn ?? (async () => "")}>
              {component}
            </AccessTokenFnContext.Provider>
          </ODataClientContext.Provider>
        </ReportsClientContext.Provider>
      </EC3JobsClientContext.Provider>
    </EC3ConfigurationsClientContext.Provider>
  )
}