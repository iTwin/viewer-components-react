/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { GroupMinimal, Mapping, Property } from "@itwin/insights-client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { GroupingMappingContextProps, ContextCustomUI, GroupingMappingCustomUI } from "@itwin/grouping-mapping-widget";
import { GroupingMappingContext, GroupingMappingCustomUIType, useMappingClient } from "@itwin/grouping-mapping-widget";
import "./GroupingMapping.scss";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { SvgList } from "@itwin/itwinui-icons-react";
import { GroupingMappingContent } from "./GroupingMappingContent";
import { GroupingMappingHeader } from "./GroupingMappingHeader";
import { defaultGroupingUI } from "./customUI/DefaultGroupingUI";
import { IModelApp } from "@itwin/core-frontend";
import { ValidationRule } from "./PropertyTable/PropertyMenu";

export type GroupingMappingProps = Omit<GroupingMappingContextProps, "iModelId">;

export enum RouteStep {
  Groups,
  GroupAction,
  GroupContextCustomUI,
  Properties,
  PropertyAction,
}

export interface Route {
  step: RouteStep;
  title: string;
  groupingRouteFields: GroupingRouteFields;
}
export interface GroupingRouteFields {
  mapping?: Mapping;
  group?: GroupMinimal;
  property?: Property;
  rule?: ValidationRule;
  calculatedProperty?: Property;
  customCalculation?: Property;
  // Optional prop but cannot be declared undefined.
  groupContextCustomUI?: Exclude<ContextCustomUI["uiComponent"], undefined>;
  queryGenerationType?: string;
}

const GroupingMapping = (props: GroupingMappingProps) => {
  const mappingClient = useMappingClient();

  useEffect(() => {
    async function fetchMapping() {
      const accessToken = (await IModelApp.authorizationClient?.getAccessToken()) || "";
      const mapping = await mappingClient.getMapping(accessToken, "5feeb119-d808-4045-bd62-5809d6aa12a9");
      setRoutingHistory([{ step: RouteStep.Groups, title: "Groups", groupingRouteFields: { mapping } }]);
    }
    fetchMapping();
  }, [mappingClient]);

  const [routingHistory, setRoutingHistory] = useState<Route[]>([
    {
      step: RouteStep.Groups,
      title: "Groups",
      groupingRouteFields: {
        mapping: undefined,
      },
    },
  ]);
  const currentRoute = routingHistory[routingHistory.length - 1];
  const activeIModelConnection = useActiveIModelConnection();
  const iModelConnection = props.iModelConnection ?? activeIModelConnection;
  const iModelId = iModelConnection?.iModelId ?? "";
  const navigateTo = useCallback((toRoute: (prev: Route | undefined) => Route) => {
    setRoutingHistory((r) => [...r, toRoute(r[r.length - 1])]);
  }, []);

  const goBack = useCallback(() => {
    const updatedRouting = [...routingHistory];
    updatedRouting.pop();
    setRoutingHistory(updatedRouting);
  }, [routingHistory]);

  const injectedCustomUI = useMemo<GroupingMappingCustomUI[]>(
    () => [
      {
        name: "Properties",
        displayLabel: "Properties",
        type: GroupingMappingCustomUIType.Context,
        icon: <SvgList />,
        onClick: (group) =>
          navigateTo((prev) => ({
            step: RouteStep.Properties,
            title: group.groupName,
            groupingRouteFields: { ...prev?.groupingRouteFields, group },
          })),
      },
      // No group UI's provided means the widget provides its own
      ...(props.customUIs ?? defaultGroupingUI),
    ],
    [props.customUIs, navigateTo],
  );

  return (
    <GroupingMappingContext iModelId={iModelId} {...props} customUIs={injectedCustomUI}>
      <div className="gmw-group-mapping-container">
        <GroupingMappingHeader goBack={goBack} currentRoute={currentRoute} />
        <GroupingMappingContent routingHistory={routingHistory} navigateTo={navigateTo} goBack={goBack} />
      </div>
    </GroupingMappingContext>
  );
};

export default GroupingMapping;
