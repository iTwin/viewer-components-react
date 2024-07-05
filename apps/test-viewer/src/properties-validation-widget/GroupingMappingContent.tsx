/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React, { useEffect } from "react";
import { usePropertiesGroupColorContext } from "./PropertiesGroupColorContext";
import type { Route } from "./GroupingMapping";
import { GroupsRouter } from "./Router/GroupsRouter";

export const GroupingMappingContent = ({
  routingHistory,
  navigateTo,
  goBack,
}: {
  routingHistory: Route[];
  navigateTo: (toRoute: (prev: Route | undefined) => Route) => void;
  goBack: () => void;
}) => {
  const { setShowGroupColor: setPropertiesShowGroup } = usePropertiesGroupColorContext();
  const currentRoute = routingHistory[routingHistory.length - 1];

  useEffect(() => {
    // Turn off visualization in properties menu
    if (routingHistory.length === 1) {
      setPropertiesShowGroup(false);
    }
  }, [routingHistory, setPropertiesShowGroup]);

  return <GroupsRouter currentRoute={currentRoute} navigateTo={navigateTo} goBack={goBack} />;
};
