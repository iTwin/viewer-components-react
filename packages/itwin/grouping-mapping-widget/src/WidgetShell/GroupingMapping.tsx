/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type {
  Group,
  GroupMinimal,
  Mapping,
  Property,
} from "@itwin/insights-client";
import React, { useCallback, useMemo, useState } from "react";
import type { GroupingMappingContextProps } from "../components/GroupingMappingContext";
import { GroupingMappingContext } from "../components/GroupingMappingContext";
import "./GroupingMapping.scss";
import { useActiveIModelConnection } from "@itwin/appui-react";
import type {
  ContextCustomUI,
  GroupingMappingCustomUI,
} from "../components/customUI/GroupingMappingCustomUI";
import { GroupingMappingCustomUIType } from "../components/customUI/GroupingMappingCustomUI";
import {
  SvgList,
} from "@itwin/itwinui-icons-react";
import { GroupingMappingContent } from "./GroupingMappingContent";
import { GroupingMappingHeader } from "./GroupingMappingHeader";
import { defaultGroupingUI } from "../components/customUI/DefaultGroupingUI";

export type GroupingMappingProps = Omit<GroupingMappingContextProps, "iModelId">;

export enum RouteStep {
  Mappings,
  MappingsAction,
  Groups,
  GroupAction,
  GroupContextCustomUI,
  Properties,
  PropertyAction,
  CalculatedPropertyAction,
  CustomCalculationPropertyAction,
}

export interface Route {
  step: RouteStep;
  title: string;
  groupingRouteFields: GroupingRouteFields;
}
export interface GroupingRouteFields {
  mapping?: Mapping;
  group?: Group | GroupMinimal;
  property?: Property;
  calculatedProperty?: Property;
  customCalculation?: Property;
  // Optional prop but cannot be declared undefined.
  groupContextCustomUI?: Exclude<ContextCustomUI["uiComponent"], undefined>;
  queryGenerationType?: string;
}

const GroupingMapping = (props: GroupingMappingProps) => {
  const [routingHistory, setRoutingHistory] = useState<Route[]>([
    { step: RouteStep.Mappings, title: "Mapping", groupingRouteFields: {} },
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
      ...props.customUIs ?? defaultGroupingUI,
    ],
    [props.customUIs, navigateTo]
  );

  return (
    <GroupingMappingContext
      iModelId={iModelId}
      {...props}
      customUIs={injectedCustomUI}
    >
      <div className="gmw-group-mapping-container">
        <GroupingMappingHeader
          goBack={goBack}
          currentRoute={currentRoute}
        />
        <GroupingMappingContent
          routingHistory={routingHistory}
          navigateTo={navigateTo}
          goBack={goBack}
        />
      </div>
    </GroupingMappingContext>
  );
};

export default GroupingMapping;
