/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IEC3JobsClient } from "@itwin/insights-client";
import { EC3JobsClient } from "@itwin/insights-client";
import { createContext, useContext } from "react";

export const BASE_PATH = "https://api.bentley.com/insights/carbon-calculation";

const prefixUrl = (prefix: string) => {
  return BASE_PATH.replace("api.bentley.com", `${prefix}-api.bentley.com`);
};

export const createDefaultEC3JobsClient = (prefix?: string): IEC3JobsClient => {
  const url = prefixUrl(prefix ?? "");
  return new EC3JobsClient(url);
};

export const createEC3JobsClient = (prefix?: string) => {
  return createDefaultEC3JobsClient(prefix);
};

export const EC3JobsClientContext = createContext<IEC3JobsClient>(createDefaultEC3JobsClient());

export const useEC3JobsClient = () => {
  const context = useContext(EC3JobsClientContext);
  if (!context) {
    throw new Error(
      "useEC3JobsClient should be used within a EC3JobsClientContext provider"
    );
  }
  return context;
};
