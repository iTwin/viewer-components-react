/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import type { CalculatedProperty, CustomCalculation, GroupProperty } from "@itwin/insights-client";

export interface Properties {
  groupProperties?: GroupProperty[];
  calculatedProperties?: CalculatedProperty[];
  customCalculationProperties?: CustomCalculation[];
  setGroupProperties: (groupProperties: GroupProperty[]) => void;
  setCalculatedProperties: (calculatedProperties: CalculatedProperty[]) => void;
  setCustomCalculationProperties: (customCalculationProperties: CustomCalculation[]) => void;
}

export const PropertiesContext = React.createContext<Properties>({
  setGroupProperties: () => { },
  setCalculatedProperties: () => { },
  setCustomCalculationProperties: () => { },
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
