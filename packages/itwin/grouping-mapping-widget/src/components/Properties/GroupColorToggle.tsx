/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useEffect, useState } from "react";
import type { ToggleSwitchProps } from "@itwin/itwinui-react";
import { toaster, ToggleSwitch } from "@itwin/itwinui-react";
import type { Group } from "@itwin/insights-client";
import { clearEmphasizedOverriddenElements, clearHiddenElements, visualizeElements, zoomToElements } from "../../common/viewerUtils";
import { Presentation } from "@itwin/presentation-frontend";
import { useGroupingMappingApiConfig } from "../context/GroupingApiConfigContext";
import { useGroupKeySetQuery } from "../Groups/hooks/useKeySetHiliteQueries";
import { usePropertiesContext } from "../context/PropertiesContext";

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
  const { showGroupColor, setShowGroupColor } = usePropertiesContext();
  const { data: hiliteIdsResult } = useGroupKeySetQuery(group, iModelConnection, showGroupColor);

  useEffect(() => {
    const visualize = async () => {
      try {
        setIsLoading(true);
        clearEmphasizedOverriddenElements();
        clearHiddenElements();
        if (showGroupColor && hiliteIdsResult) {
          Presentation.selection.clearSelection(
            "GroupingMappingWidget",
            iModelConnection,
          );
          visualizeElements(hiliteIdsResult.result.ids, color);
          await zoomToElements(hiliteIdsResult.result.ids);
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
  }, [color, hiliteIdsResult, iModelConnection, showGroupColor]);

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
