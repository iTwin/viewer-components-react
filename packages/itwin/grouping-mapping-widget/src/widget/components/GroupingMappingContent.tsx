/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useEffect } from "react";
import { useGroupHilitedElementsContext } from "./context/GroupHilitedElementsContext";
import { usePropertiesContext } from "./context/PropertiesContext";
import type { Route } from "./GroupingMapping";
import { GroupingMappingRouter } from "./GroupingMappingRouter";
import { clearAll } from "./viewerUtils";

export const GroupingMappingContent = ({
  routingHistory,
  navigateTo,
  goBack,
}: {
  routingHistory: Route[];
  navigateTo: (toRoute: (prev: Route | undefined) => Route) => void;
  goBack: () => void;
}) => {
  const { setShowGroupColor, setHiddenGroupsIds } = useGroupHilitedElementsContext();
  const { setShowGroupColor: setPropertiesShowGroup } = usePropertiesContext();
  const currentRoute = routingHistory[routingHistory.length - 1];

  // Clean up group visualization when in mappings
  useEffect(() => {
    if (routingHistory.length === 1) {
      setShowGroupColor(false);
      setHiddenGroupsIds([]);
      clearAll();
      // Turn off visualiztion in properties menu
    } else if (routingHistory.length === 2) {
      setPropertiesShowGroup(false);
    }
  }, [routingHistory, setHiddenGroupsIds, setPropertiesShowGroup, setShowGroupColor]);

  return (
    <GroupingMappingRouter
      currentRoute={currentRoute}
      navigateTo={navigateTo}
      goBack={goBack}
    />
  );
};
