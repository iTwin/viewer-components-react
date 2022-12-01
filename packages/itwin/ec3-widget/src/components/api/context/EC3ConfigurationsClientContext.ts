/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IEC3ConfigurationsClient } from "@itwin/insights-client";
import { EC3ConfigurationsClient } from "@itwin/insights-client";
import { createContext, useContext } from "react";

export const createEC3ConfigurationsClient = (url: string) => {
  return new EC3ConfigurationsClient(url);
};

export const EC3ConfigurationsClientContext = createContext<IEC3ConfigurationsClient>(createEC3ConfigurationsClient(""));

export const useEC3ConfigurationsClient = () => {
  const context = useContext(EC3ConfigurationsClientContext);
  if (!context) {
    throw new Error(
      "useEC3ConfigurationsClient should be used within a EC3ConfigurationsClientContext provider"
    );
  }
  return context;
};
