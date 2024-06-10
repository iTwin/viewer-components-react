/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import React, { useCallback, useState } from "react";
import "./ReportsContainer.scss";
import type { Report } from "@itwin/insights-client";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { ReportsHeader } from "./ReportsHeader";
import { ReportsRouter } from "./ReportsRouter";
import { ReportsConfigContext } from "./ReportsConfigContext";

interface ReportsContainerProps {
  getAccessToken?: () => Promise<AccessToken>;
  baseUrl: string;
}

export enum RouteStep {
  ReportsList,
  ReportAction,
  ReportMappings,
}

export interface ReportsRouteFields {
  report?: Report;
}

export interface Route {
  step: RouteStep;
  title: string;
  reportsRoutingFields: ReportsRouteFields;
}

const ReportsContainer = ({ getAccessToken, baseUrl }: ReportsContainerProps) => {
  const [routingHistory, setRoutingHistory] = useState<Route[]>([{ step: RouteStep.ReportsList, title: "iTwin Reports", reportsRoutingFields: {} }]);
  const currentRoute = routingHistory[routingHistory.length - 1];
  const iTwinId = useActiveIModelConnection()?.iTwinId ?? "";
  const navigateTo = useCallback((toRoute: (prev: Route | undefined) => Route) => {
    setRoutingHistory((r) => [...r, toRoute(r[r.length - 1])]);
  }, []);

  const goBack = useCallback(() => {
    const updatedRouting = [...routingHistory];
    updatedRouting.pop();
    setRoutingHistory(updatedRouting);
  }, [routingHistory]);

  return (
    <ReportsConfigContext getAccessToken={getAccessToken} baseUrl={baseUrl} iTwinId={iTwinId}>
      <div className="rcw-reports-container">
        <ReportsHeader goBack={goBack} currentRoute={currentRoute} />
        <ReportsRouter currentRoute={currentRoute} navigateTo={navigateTo} goBack={goBack} />
      </div>
    </ReportsConfigContext>
  );
};

export default ReportsContainer;
