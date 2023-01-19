import React, { useEffect } from "react";
import { useGroupHilitedElementsContext } from "./context/GroupHilitedElementsContext";
import type { Route } from "./GroupingMapping";
import { GroupingMappingRouter } from "./GroupingMappingRouter";
import { clearEmphasizedElements, clearHiddenElements, clearOverriddenElements } from "./viewerUtils";

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
  const currentRoute = routingHistory[routingHistory.length - 1];

  // Clean up group visualization when in mappings
  useEffect(() => {
    if (routingHistory.length === 1) {
      setShowGroupColor(false);
      setHiddenGroupsIds([]);
      clearOverriddenElements();
      clearEmphasizedElements();
      clearHiddenElements();
    }
  }, [routingHistory, setHiddenGroupsIds, setShowGroupColor]);

  return (
    <GroupingMappingRouter
      currentRoute={currentRoute}
      navigateTo={navigateTo}
      goBack={goBack}
    />
  );
};
