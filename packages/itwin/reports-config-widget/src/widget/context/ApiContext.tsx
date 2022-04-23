/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import * as React from "react";
import { createContext } from "react";

export interface Api {
  accessToken: AccessToken;
  prefix?: "" | "dev" | "qa";
}

export const ApiContext = createContext<Api>({ accessToken: "" });

export const useApi = () => {
  const context = React.useContext(ApiContext)
  if (!context) {
    throw new Error('useApiContext should be used within a Api Context provider')
  }
  return context;
}