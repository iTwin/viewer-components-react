/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React, { useEffect } from "react";
import { useGroupHilitedElementsContext } from "../components/context/GroupHilitedElementsContext";
import { usePropertiesGroupColorContext } from "../components/context/PropertiesGroupColorContext";
import type { Route } from "./GroupingMapping";
import { GroupingMappingRouter } from "./Router/GroupingMappingRouter";
import { clearAll } from "../common/viewerUtils";

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
  const { setShowGroupColor: setPropertiesShowGroup } = usePropertiesGroupColorContext();
  const currentRoute = routingHistory[routingHistory.length - 1];

  // Clean up group visualization when in mappings
  useEffect(() => {
    if (routingHistory.length === 1) {
      setShowGroupColor(false);
      setHiddenGroupsIds(new Set());
      clearAll();
      // Turn off visualiztion in properties menu
    } else if (routingHistory.length === 2) {
      setPropertiesShowGroup(false);
    }
  }, [routingHistory, setHiddenGroupsIds, setPropertiesShowGroup, setShowGroupColor]);

  return <GroupingMappingRouter currentRoute={currentRoute} navigateTo={navigateTo} goBack={goBack} />;
};
