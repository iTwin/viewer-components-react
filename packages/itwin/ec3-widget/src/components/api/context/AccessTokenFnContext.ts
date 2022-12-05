/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import * as React from "react";
import { createContext } from "react";

export type GetAccessTokenFn = () => Promise<AccessToken>;

export const AccessTokenFnContext =
  createContext<GetAccessTokenFn>(async () => "");

export const useAccessTokenFn = () => {
  const context = React.useContext(AccessTokenFnContext);
  if (!context) {
    throw new Error(
      "useGroupingMappingApiConfig should be used within a AccessTokenFnContext provider"
    );
  }
  return context;
};
