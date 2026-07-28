/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import type { GroupingCustomUI } from "../../customUI/GroupingMappingCustomUI";
import { EmptyMessage } from "../../SharedComponents/EmptyMessage";
import type { GroupMinimal } from "@itwin/insights-client";
import { GroupingMappingWidget } from "../../../GroupingMappingWidget";

export interface QueryBuilderCustomUIProps {
  queryGenerationType: string;
  groupUIs: GroupingCustomUI[];
  isUpdating: boolean;
  resetView: () => Promise<void>;
  setQuery: (query: string) => void;
  group?: GroupMinimal;
}

export const QueryBuilderCustomUI = ({ queryGenerationType, groupUIs, isUpdating, resetView, setQuery, group }: QueryBuilderCustomUIProps) => {
  if (queryGenerationType && queryGenerationType.length > 0) {
    const selectedCustomUI = groupUIs.find((e) => e.name === queryGenerationType);
    if (selectedCustomUI) {
      return React.createElement(selectedCustomUI.uiComponent, {
        updateQuery: setQuery,
        isUpdating,
        resetView,
        initialEditModeQuery: group?.query,
      });
    }
  }
  return <EmptyMessage message={GroupingMappingWidget.translate("customUI.noQueryMethod")} />;
};
