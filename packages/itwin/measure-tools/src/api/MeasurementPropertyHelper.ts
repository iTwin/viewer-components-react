/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { MeasureTools } from "../MeasureTools.js";
import type { Measurement, WidgetValue } from "./Measurement.js";

export class MeasurementPropertyHelper {
  public static buildNameProperty(name: string): WidgetValue {
    return {
      label: MeasureTools.localization.getLocalizedString(
        "MeasureTools:Generic.name"
      ),
      name: "Measurement_Name",
      value: name,
    };
  }

  public static tryAddNameProperty(
    measurement: Measurement,
    properties: WidgetValue[]
  ): boolean {
    if (!measurement.label) return false;

    properties.push(
      MeasurementPropertyHelper.buildNameProperty(measurement.label)
    );
    return true;
  }
}
