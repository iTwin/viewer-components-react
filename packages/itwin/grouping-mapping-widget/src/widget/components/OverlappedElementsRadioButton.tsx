/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useEffect, useState } from "react";
import type { ToggleSwitchProps } from "@itwin/itwinui-react";
import { toaster, Radio } from "@itwin/itwinui-react";
import { clearEmphasizedOverriddenElements, visualizeElements, zoomToElements } from "./viewerUtils";
import { Presentation } from "@itwin/presentation-frontend";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";

export type OverlappedElementsRadioButtonProps = Partial<ToggleSwitchProps> & {
  color: string;
  ids: string[];
  showOverlappedColor: boolean;
  setShowOverlappedColor: (showOverlappedColor: boolean) => void;
};

export const OverlappedElementsRadioButton = ({
  color,
  ids,
  showOverlappedColor,
  setShowOverlappedColor,
}: OverlappedElementsRadioButtonProps) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { iModelConnection } = useGroupingMappingApiConfig();
  if (!iModelConnection) {
    throw new Error("This component requires an active iModelConnection.");
  }

  useEffect(() => {
    const visualize = async () => {
      try {
        setIsLoading(true);
        
        if (showOverlappedColor) {
          clearEmphasizedOverriddenElements();
          Presentation.selection.clearSelection(
            "GroupingMappingWidget",
            iModelConnection,
          );

          visualizeElements(ids, color);
          await zoomToElements(ids);
        }
      } catch (error) {
        toaster.negative("There was an error visualizing overlapped Elements.");
        /* eslint-disable no-console */
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    void visualize();
  }, [iModelConnection, color, ids, showOverlappedColor]);

  return (
    <Radio
      disabled={isLoading}
      checked={showOverlappedColor}
      onClick={() => setShowOverlappedColor(!showOverlappedColor)}
    />
  );
};