/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type {
  CalculatedProperty,
  CustomCalculation,
  Group,
  GroupProperty,
  Mapping,
} from "@itwin/insights-client";
import React, { useCallback, useMemo, useState } from "react";
import type { GroupingMappingContextProps } from "./GroupingMappingContext";
import { GroupingMappingContext } from "./GroupingMappingContext";
import "./GroupingMapping.scss";
import { useActiveIModelConnection } from "@itwin/appui-react";
import type {
  ContextCustomUI,
  GroupingMappingCustomUI,
} from "./customUI/GroupingMappingCustomUI";
import { GroupingMappingCustomUIType } from "./customUI/GroupingMappingCustomUI";
import {
  SvgList,
} from "@itwin/itwinui-icons-react";
import { GroupingMappingContent } from "./GroupingMappingContent";
import { GroupingMappingHeader } from "./GroupingMappingHeader";
import { defaultGroupingUI } from "./customUI/DefaultGroupingUI";

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
  group?: Group;
  property?: GroupProperty;
  calculatedProperty?: CalculatedProperty;
  customCalculation?: CustomCalculation;
  // Optional prop but cannot be declared undefined.
  groupContextCustomUI?: Exclude<ContextCustomUI["uiComponent"], undefined>;
  queryGenerationType?: string;
}

const GroupingMapping = (props: GroupingMappingProps) => {
  const [routingHistory, setRoutingHistory] = useState<Route[]>([
    { step: RouteStep.Mappings, title: "Mapping", groupingRouteFields: {} },
  ]);
  const currentRoute = routingHistory[routingHistory.length - 1];
  const iModelId = useActiveIModelConnection()?.iModelId ?? "";
  const groupUIs =
    props.customUIs?.filter(
      (p) => p.type === GroupingMappingCustomUIType.Grouping
    );
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
      ...(props.customUIs ?? []),
      // No group UI's provided means the widget provides its own
      ...groupUIs ?? defaultGroupingUI,
    ],
    [groupUIs, navigateTo, props.customUIs]
  );

  return (
    <GroupingMappingContext
      iModelId={iModelId}
      {...props}
      customUIs={injectedCustomUI}
    >
      <div className="gmw-group-mapping-container">
        {// Will remove until all components are correctly componentized
          currentRoute.step !== RouteStep.Properties && routingHistory.length < 4 &&
          <GroupingMappingHeader
            routingHistory={routingHistory}
            goBack={goBack}
            currentRoute={currentRoute}
          />}
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
