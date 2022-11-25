/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IReportsClient, ReportsClient } from "@itwin/insights-client";
import { createContext, useContext } from "react";

export const BASE_PATH = "https://api.bentley.com/insights/reporting";

const prefixUrl = (prefix: string) => {
  return BASE_PATH.replace("api.bentley.com", `${prefix}-api.bentley.com`);
};

export const createDefaultReportsClient = (prefix?: string): IReportsClient => {
  const url = prefixUrl(prefix ?? "");
  return new ReportsClient(url);
};

export const createReportsClient = (prefix?: string) => {
  return createDefaultReportsClient(prefix);
};

export const ReportsClientContext = createContext<IReportsClient>(createDefaultReportsClient());

export const useReportsClient = () => {
  const context = useContext(ReportsClientContext);
  if (!context) {
    throw new Error(
      "useReportsClient should be used within a ReportsClientContext provider"
    );
  }
  return context;
};
