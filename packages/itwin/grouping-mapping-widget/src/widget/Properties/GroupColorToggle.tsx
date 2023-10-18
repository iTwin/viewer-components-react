/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useEffect, useState } from "react";
import type { ToggleSwitchProps } from "@itwin/itwinui-react";
import { toaster, ToggleSwitch } from "@itwin/itwinui-react";
import type { Group } from "@itwin/insights-client";
import { clearEmphasizedOverriddenElements, visualizeElements, zoomToElements } from "../components/viewerUtils";
import { getHiliteIdsAndKeysetFromGroup } from "../components/Groups/groupsHelpers";
import { Presentation } from "@itwin/presentation-frontend";
import { useGroupHilitedElementsContext } from "../components/context/GroupHilitedElementsContext";
import { usePropertiesContext } from "../components/context/PropertiesContext";
import { useGroupingMappingApiConfig } from "../components/context/GroupingApiConfigContext";

export type GroupColorToggleProps = Partial<ToggleSwitchProps> & {
  color: string;
  group: Group;
};

export const GroupColorToggle = ({
  color,
  group,
  ...rest
}: GroupColorToggleProps) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { iModelConnection } = useGroupingMappingApiConfig();
  if (!iModelConnection) {
    throw new Error("This component requires an active iModelConnection.");
  }
  const { hilitedElementsQueryCache } = useGroupHilitedElementsContext();
  const { showGroupColor, setShowGroupColor } = usePropertiesContext();

  useEffect(() => {
    const visualize = async () => {
      try {
        setIsLoading(true);
        clearEmphasizedOverriddenElements();
        if (showGroupColor) {
          const result = await getHiliteIdsAndKeysetFromGroup(iModelConnection, group, hilitedElementsQueryCache);
          Presentation.selection.clearSelection(
            "GroupingMappingWidget",
            iModelConnection,
          );
          visualizeElements(result.ids, color);
          await zoomToElements(result.ids);
        }
      } catch (error) {
        toaster.negative("There was an error visualizing group.");
        /* eslint-disable no-console */
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    void visualize();
  }, [iModelConnection, group.query, group.groupName, group, hilitedElementsQueryCache, showGroupColor, color]);

  return (
    <ToggleSwitch
      label="Color Group"
      disabled={isLoading}
      checked={showGroupColor}
      onChange={() => setShowGroupColor((b) => !b)}
      {...rest}
    ></ToggleSwitch>
  );
};
