/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { IReportsClient } from "@itwin/insights-client";
import { REPORTING_BASE_PATH, ReportsClient } from "@itwin/insights-client";
import { createContext, useContext } from "react";

/**
 * @internal
 */
export const createDefaultReportsClient = (reportingBasePath?: string): IReportsClient => {
  return new ReportsClient(reportingBasePath ?? REPORTING_BASE_PATH);
};

/**
 * @internal
 */
export const ReportsClientContext = createContext<IReportsClient>(createDefaultReportsClient());

/**
 * @internal
 */
export const useReportsClient = () => {
  const context = useContext(ReportsClientContext);
  if (!context) {
    throw new Error("useReportsClient should be used within a ReportsClientContext provider");
  }
  return context;
};
