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
import { WidgetHeader } from "./utils";
import "./GroupingMapping.scss";
import { GroupingMappingRouter } from "./GroupingMappingRouter";
import { useActiveIModelConnection } from "@itwin/appui-react";
import type {
  ContextCustomUI,
  GroupingMappingCustomUI,
} from "./customUI/GroupingMappingCustomUI";
import { GroupingMappingCustomUIType } from "./customUI/GroupingMappingCustomUI";
import {
  SvgCursor,
  SvgDraw,
  SvgList,
  SvgSearch,
} from "@itwin/itwinui-icons-react";
import { GroupQueryBuilderContainer } from "./GroupQueryBuilderContainer";
import SearchGroupingCustomUI from "./customUI/SearchGroupingCustomUI";
import ManualGroupingCustomUI from "./customUI/ManualGroupingCustomUI";

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
  mapping?: Mapping;
  group?: Group;
  // Optional prop but cannot be declared undefined.
  groupContextCustomUI?: Exclude<ContextCustomUI["uiComponent"], undefined>;
  queryGenerationType?: string;
  property?: GroupProperty;
  calculatedProperty?: CalculatedProperty;
  customCalculation?: CustomCalculation;
}

const defaultGroupingUI: GroupingMappingCustomUI[] = [
  {
    name: "Selection",
    displayLabel: "Selection",
    type: GroupingMappingCustomUIType.Grouping,
    icon: <SvgCursor />,
    uiComponent: GroupQueryBuilderContainer,
  },
  {
    name: "Search",
    displayLabel: "Search",
    type: GroupingMappingCustomUIType.Grouping,
    icon: <SvgSearch />,
    uiComponent: SearchGroupingCustomUI,
  },
  {
    name: "Manual",
    displayLabel: "Manual",
    type: GroupingMappingCustomUIType.Grouping,
    icon: <SvgDraw />,
    uiComponent: ManualGroupingCustomUI,
  },
];

const GroupingMapping = (props: GroupingMappingProps) => {
  const [routingHistory, setRoutingHistory] = useState<Route[]>([
    { step: RouteStep.Mappings, title: "Mapping" },
  ]);
  // const [isLoading, setIsLoading] = useState<boolean>(false);
  const currentRoute = routingHistory[routingHistory.length - 1];
  const iModelId = useActiveIModelConnection()?.iModelId ?? "";
  const groupUIs =
    props.customUIs?.filter(
      (p) => p.type === GroupingMappingCustomUIType.Grouping
    );
  const navigateTo = useCallback((newRoute: Route) => {
    setRoutingHistory((r) => [...r, newRoute]);
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
          navigateTo({
            ...currentRoute,
            step: RouteStep.Properties,
            group,
            title: group.groupName,
          }),
      },
      ...(props.customUIs ?? []),
      // No group UI's provided means the widget provides its own
      ...groupUIs ?? defaultGroupingUI,
    ],
    [currentRoute, groupUIs, navigateTo, props.customUIs]
  );

  return (
    <GroupingMappingContext
      iModelId={iModelId}
      {...props}
      customUIs={injectedCustomUI}
    >
      <div className="gmw-group-mapping-container">
        {currentRoute.step !== RouteStep.Properties && routingHistory.length < 4 &&
          <WidgetHeader
            returnFn={
              routingHistory.length > 1
                ? () => {
                  goBack();
                }
                : undefined
            }
            title={currentRoute.title}
          />
        }
        <GroupingMappingRouter
          routingHistory={routingHistory}
          navigateTo={navigateTo}
          goBack={goBack}
        />
      </div>
    </GroupingMappingContext>
  );
};

export default GroupingMapping;
