/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { IReportsClient, OCLCAJobsClient } from "@itwin/insights-client";

/**
 * Props for the {@link OneClickLCA} component.
 * @public
 */
export interface OneClickLCAProps {
  /**
   * The base path for the Reporting API endpoints. If not specified, it defaults to REPORTING_BASE_PATH from @itwin/insights-client.
   */
  reportingBasePath?: string;

  /**
   * The base path for the Carbon Calculation API endpoints. If not specified, it defaults to CARBON_CALCULATION_BASE_PATH from @itwin/insights-client.
   */
  carbonCalculationBasePath?: string;

  /**
   * A custom implementation of ReportsClient. If provided, reportingBasePath is ignored.
   */
  reportsClient?: IReportsClient;

  /**
   * A custom implementation of OCLCAJobsClient. If provided, carbonCalculationBasePath is ignored.
   */
  oclcaJobsClient?: OCLCAJobsClient;
}
