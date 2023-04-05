/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import type { Route } from "./GroupingMapping";
import { WidgetHeader } from "./WidgetHeader";

export const GroupingMappingHeader = ({
  routingHistory,
  goBack,
  currentRoute,
}: {
  routingHistory: Route[];
  goBack: () => void;
  currentRoute: Route;
}) => {
  return (
    <WidgetHeader
      returnFn={
        routingHistory.length > 1 ? goBack : undefined
      }
      title={currentRoute.title}
    />
  );
};
