/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import type { GroupingCustomUI } from "./customUI/GroupingMappingCustomUI";
import { EmptyMessage } from "./utils";

export interface QueryBuilderCustomUIProps {
  queryGenerationType: string;
  groupUIs: GroupingCustomUI[];
  isUpdating: boolean;
  resetView: () => Promise<void>;
  setQuery: (query: string) => void;
}

export const QueryBuilderCustomUI = ({
  queryGenerationType,
  groupUIs,
  isUpdating,
  resetView,
  setQuery,
}: QueryBuilderCustomUIProps) => {
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
