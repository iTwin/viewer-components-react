/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AlertPriority } from "../../enums/alerts/AlertPriorityEnum";

export interface AlertPriorityMetadataObject {
  id: AlertPriority | "default";
  priority: number;
  name: string;
  color: string;
}
