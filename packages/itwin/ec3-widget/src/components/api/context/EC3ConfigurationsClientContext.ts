/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IEC3ConfigurationsClient} from "@itwin/insights-client";
import { EC3ConfigurationsClient } from "@itwin/insights-client";
import { createContext, useContext } from "react";

export const BASE_PATH = "https://api.bentley.com/insights/carbon-calculation";

const prefixUrl = (prefix: string) => {
  return BASE_PATH.replace("api.bentley.com", `${prefix}-api.bentley.com`);
};

export const createDefaultEC3ConfigurationsClient = (prefix?: string): IEC3ConfigurationsClient => {
  const url = prefixUrl(prefix ?? "");
  return new EC3ConfigurationsClient(url);
};

export const createEC3ConfigurationsClient = (prefix?: string) => {
  return createDefaultEC3ConfigurationsClient(prefix);
};

export const EC3ConfigurationsClientContext = createContext<IEC3ConfigurationsClient>(createDefaultEC3ConfigurationsClient());

export const useEC3ConfigurationsClient = () => {
  const context = useContext(EC3ConfigurationsClientContext);
  if (!context) {
    throw new Error(
      "useEC3ConfigurationsClient should be used within a EC3ConfigurationsClientContext provider"
    );
  }
  return context;
};
