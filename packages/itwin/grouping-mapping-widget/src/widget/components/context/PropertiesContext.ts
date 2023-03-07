/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import type { CalculatedProperty, CustomCalculation, GroupProperty } from "@itwin/insights-client";

export interface Properties {
  showGroupColor: boolean;
  groupProperties?: GroupProperty[];
  calculatedProperties?: CalculatedProperty[];
  customCalculationProperties?: CustomCalculation[];
  setGroupProperties: (groupProperties: GroupProperty[]) => void;
  setCalculatedProperties: (calculatedProperties: CalculatedProperty[]) => void;
  setCustomCalculationProperties: (customCalculationProperties: CustomCalculation[]) => void;
  setShowGroupColor: (showGroupColor: boolean | ((showGroupColor: boolean) => boolean)) => void;
}

export const PropertiesContext = React.createContext<Properties>({
  showGroupColor: false,
  setGroupProperties: () => { },
  setCalculatedProperties: () => { },
  setCustomCalculationProperties: () => { },
  setShowGroupColor: () => { },
});

export const usePropertiesContext = (): Properties => {
  const context = React.useContext(PropertiesContext);
  if (!context) {
    throw new Error(
      "usePropertiesContext should be used within a PropertiesContext provider"
    );
  }
  return context;
};
