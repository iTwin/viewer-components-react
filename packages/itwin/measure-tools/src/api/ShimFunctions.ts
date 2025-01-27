/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Measurement, MeasurementPickContext } from "./Measurement.js";

// DO NOT export this file for third parties. Using this to avoid circular dependencies.

export class ShimFunctions {
  public static defaultButtonEventAction?: (measurement: Measurement, pickContext: MeasurementPickContext) => void;
  public static getAllMeasurements = (): ReadonlyArray<Measurement> => [];
  public static forAllMeasurements = (_callback: (measurement: Measurement) => boolean) => { return; };
}
