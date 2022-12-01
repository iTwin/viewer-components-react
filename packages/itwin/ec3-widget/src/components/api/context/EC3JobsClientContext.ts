/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IEC3JobsClient } from "@itwin/insights-client";
import { EC3JobsClient } from "@itwin/insights-client";
import { createContext, useContext } from "react";

export const createEC3JobsClient = (url: string) => {
  return new EC3JobsClient(url);
};

export const EC3JobsClientContext = createContext<IEC3JobsClient>(createEC3JobsClient(""));

export const useEC3JobsClient = () => {
  const context = useContext(EC3JobsClientContext);
  if (!context) {
    throw new Error(
      "useEC3JobsClient should be used within a EC3JobsClientContext provider"
    );
  }
  return context;
};
