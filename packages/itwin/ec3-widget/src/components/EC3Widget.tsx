/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { useActiveIModelConnection } from "@itwin/appui-react";
import React, { useCallback, useState } from "react";
import type { EC3ConfigPropsWithDefaultMapping, EC3ConfigPropsWithGetEC3AccessToken, EC3ConfigPropsWithRedirectUri } from "./EC3/EC3Config";
import { EC3Context } from "./EC3Context";
import { EC3Header } from "./EC3Header";
import { EC3Router } from "./EC3Router";
import type { Configuration } from "./EC3/Template";
import "./EC3Widget.scss";

export type EC3WidgetProps =
  | Omit<EC3ConfigPropsWithRedirectUri, "iTwinId">
  | Omit<EC3ConfigPropsWithGetEC3AccessToken, "iTwinId">
  | Omit<EC3ConfigPropsWithDefaultMapping, "iTwinId">;

export enum RouteStep {
  Templates,
  TemplateMenu,
}

export interface EC3RouteFields {
  template?: Configuration;
}

export interface Route {
  step: RouteStep;
  title: string;
  routingFields: EC3RouteFields;
}

export const EC3Widget = (props: EC3WidgetProps) => {
  const [routingHistory, setRoutingHistory] = useState<Route[]>([{ step: RouteStep.Templates, title: "EC3 Templates", routingFields: {} }]);
  const currentRoute = routingHistory[routingHistory.length - 1];
  const iTwinId = useActiveIModelConnection()?.iTwinId ?? "";
  const navigateTo = useCallback((getNextRoute: (prev: Route | undefined) => Route) => {
    setRoutingHistory((r) => [...r, getNextRoute(r[r.length - 1])]);
  }, []);

  const goBack = useCallback(() => {
    const updatedRouting = [...routingHistory];
    updatedRouting.pop();
    setRoutingHistory(updatedRouting);
  }, [routingHistory]);

  return (
    <EC3Context {...props} iTwinId={iTwinId}>
      <div className="ec3w-container">
        <EC3Header currentRoute={currentRoute} />
        <EC3Router currentRoute={currentRoute} navigateTo={navigateTo} goBack={goBack} />
      </div>
    </EC3Context>
  );
};
