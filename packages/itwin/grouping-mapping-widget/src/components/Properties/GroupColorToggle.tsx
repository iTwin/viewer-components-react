/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useCallback, useEffect } from "react";
import type { ToggleSwitchProps } from "@itwin/itwinui-react";
import { toaster, ToggleSwitch } from "@itwin/itwinui-react";
import type { Group } from "@itwin/insights-client";
import { clearAll, visualizeElements, zoomToElements } from "../../common/viewerUtils";
import { Presentation } from "@itwin/presentation-frontend";
import { useGroupingMappingApiConfig } from "../context/GroupingApiConfigContext";
import type { QueryResults } from "../Groups/hooks/useKeySetHiliteQueries";
import { useGroupKeySetQuery } from "../Groups/hooks/useKeySetHiliteQueries";
import { usePropertiesGroupColorContext } from "../context/PropertiesGroupColorContext";
import { useMutation } from "@tanstack/react-query";
import { useIsMounted } from "../../common/hooks/useIsMounted";

export type GroupColorToggleProps = Partial<ToggleSwitchProps> & {
  color: string;
  group: Group;
};

export const GroupColorToggle = ({
  color,
  group,
  ...rest
}: GroupColorToggleProps) => {
  const { iModelConnection } = useGroupingMappingApiConfig();
  if (!iModelConnection) {
    throw new Error("This component requires an active iModelConnection.");
  }
  const { showGroupColor, setShowGroupColor } = usePropertiesGroupColorContext();
  const { data: hiliteIdsResult, isFetched, isFetching } = useGroupKeySetQuery(group, iModelConnection, showGroupColor);
  const isMounted = useIsMounted();

  const { mutate: mutateVisualization, isLoading: isVisualizing } = useMutation({
    mutationFn: async (hiliteIds: QueryResults) => {
      clearAll();
      Presentation.selection.clearSelection(
        "GroupingMappingWidget",
        iModelConnection,
      );
      visualizeElements(hiliteIds.result.ids, color);
      await zoomToElements(hiliteIds.result.ids);
    },
    onError: (error) => {
      toaster.negative("There was an error visualizing group.");
      // eslint-disable-next-line no-console
      console.error(error);
    },
  });

  useEffect(() => {
    isFetched && showGroupColor && hiliteIdsResult && isMounted && mutateVisualization(hiliteIdsResult);
  }, [hiliteIdsResult, isFetched, isMounted, showGroupColor, mutateVisualization]);

  const handleToggleChange = useCallback(() => {
    setShowGroupColor((b) => {
      if (b) {
        clearAll();
      }
      return !b;
    });
  }, [setShowGroupColor]);

  const isLoading = isFetching || isVisualizing;

  return (
    <ToggleSwitch
      label="Color Group"
      disabled={isLoading}
      checked={showGroupColor}
      onChange={handleToggleChange}
      {...rest}
    ></ToggleSwitch>
  );
};
