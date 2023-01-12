import React from "react";
import type { Route } from "./GroupingMapping";
import { WidgetHeader } from "./utils";

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
