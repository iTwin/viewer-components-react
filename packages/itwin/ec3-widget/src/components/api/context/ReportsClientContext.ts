/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IReportsClient } from "@itwin/insights-client";
import { ReportsClient } from "@itwin/insights-client";
import { createContext, useContext } from "react";

export const createReportsClient = (url: string) => {
  return new ReportsClient(url);
};

export const ReportsClientContext = createContext<IReportsClient>(createReportsClient(""));

export const useReportsClient = () => {
  const context = useContext(ReportsClientContext);
  if (!context) {
    throw new Error(
      "useReportsClient should be used within a ReportsClientContext provider"
    );
  }
  return context;
};
