/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Sensor } from "./SensorModel";
import type { Alert } from "../alerts/AlertModel";
import type { ObservationSet } from "../observations/ObservationSetModel";

export interface SensorData {
  sensor: Sensor;
  alerts?: Alert[];
  observations?: ObservationSet[];
  firstReadingDate?: string;
}
