import React from "react";
import type { GroupingCustomUI } from "./customUI/GroupingMappingCustomUI";
import { EmptyMessage } from "./utils";

export const QueryBuilderCustomUI = ({
  queryGenerationType,
  groupUIs,
  isUpdating,
  resetView,
  setQuery,
}: {
  queryGenerationType: string;
  groupUIs: GroupingCustomUI[];
  isUpdating: boolean;
  resetView: () => Promise<void>;
  setQuery: (query: string) => void;
}) => {
  if (queryGenerationType && queryGenerationType.length > 0) {
    const selectedCustomUI = groupUIs.find((e) => e.name === queryGenerationType);
    if (selectedCustomUI) {
      return React.createElement(selectedCustomUI.uiComponent, {
        updateQuery: setQuery,
        isUpdating,
        resetView,
      });
    }
  }
  return <EmptyMessage message="No query generation method selected. " />;
};
