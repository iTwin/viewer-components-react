/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { ITwinsAccessClient } from "@itwin/itwins-client";
import { createContext, useContext } from "react";
import type { ClientPrefix } from "./GroupingApiConfigContext";

const baseUrl: string = "https://api.bentley.com/itwins";

const prefixUrl = (baseUrl?: string, prefix?: string) => {
  if (prefix && baseUrl) {
    return baseUrl.replace("api.bentley.com", `${prefix}-api.bentley.com`);
  }
  return baseUrl;
};

export const createITwinsClient = (prefix?: ClientPrefix): ITwinsAccessClient => {
  const url = prefixUrl(baseUrl, prefix);
  return new ITwinsAccessClient(url);
};

export const ITwinsClientContext = createContext<ITwinsAccessClient>(createITwinsClient());

export const useITwinsClient = () => {
  const context = useContext(ITwinsClientContext);
  if (!context) {
    throw new Error("useITwinsClient should be used within an ITwinsClientContext provider");
  }
  return context;
};
