/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { CARBON_CALCULATION_BASE_PATH, OCLCAJobsClient } from "@itwin/insights-client";
import { createContext, useContext } from "react";

/**
 * @internal
 */
export const createDefaultOCLCAJobsClient = (carbonCalculationBasePath?: string): OCLCAJobsClient =>
  new OCLCAJobsClient(carbonCalculationBasePath ?? CARBON_CALCULATION_BASE_PATH);

/**
 * @internal
 */
export const OCLCAJobsClientContext = createContext<OCLCAJobsClient>(createDefaultOCLCAJobsClient());

/**
 * @internal
 */
export const useOCLCAJobsClient = () => {
  const context = useContext(OCLCAJobsClientContext);
  if (!context) {
    throw new Error("useOCLCAJobsClient should be used within a OCLCAJobsClientContext provider");
  }
  return context;
};
