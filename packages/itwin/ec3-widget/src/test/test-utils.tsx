/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { EC3ConfigurationsClient, EC3JobsClient, IEC3ConfigurationsClient, IEC3JobsClient, IOdataClient, IReportsClient, ODataClient, ReportsClient } from "@itwin/insights-client";
import { render, RenderResult } from "@testing-library/react";
import React from "react";
import { ApiContext, GetAccessTokenFn } from "../components/api/APIContext"

export interface RenderParameters {
  component: React.ReactNode,
  ec3ConfigurationsClient?: IEC3ConfigurationsClient,
  ec3JobsClient?: IEC3JobsClient,
  reportsClient?: IReportsClient,
  oDataClient?: IOdataClient,
  getAccessTokenFn?: GetAccessTokenFn
}

export function renderWithContext({
  component, ec3ConfigurationsClient, ec3JobsClient, reportsClient, oDataClient, getAccessTokenFn
}: RenderParameters): RenderResult {
  return render(
    <ApiContext.Provider value={{
      reportsClient: reportsClient ?? new ReportsClient(),
      oDataClient: oDataClient ?? new ODataClient(),
      ec3JobsClient: ec3JobsClient ?? new EC3JobsClient(),
      ec3ConfigurationsClient: ec3ConfigurationsClient ?? new EC3ConfigurationsClient(),
      getAccessTokenFn: getAccessTokenFn ?? (async () => ""),
    }}>
      {component}
    </ApiContext.Provider>
  )
}