/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { EC3ConfigurationLabel } from "@itwin/insights-client";

/**
 * Template configuration
 * @public
 */
export interface Configuration {
  displayName: string;
  description: string;
  id?: string;
  reportId?: string;
  labels: EC3ConfigurationLabel[];
}
