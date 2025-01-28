/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { MeasurementManager } from "../../api/MeasurementManager.js";
import { MeasurementPreferences } from "../../api/MeasurementPreferences.js";
import { DistanceMeasurement } from "../../measurements/DistanceMeasurement.js";

describe("MeasurementPreferences tests", () => {
  it("Test showAxes", () => {
    MeasurementPreferences.current.displayMeasurementAxes = true;
    const test1 = new DistanceMeasurement();
    assert.isTrue(test1.showAxes);

    const test1Added = test1.clone<DistanceMeasurement>();
    MeasurementManager.instance.clear();
    MeasurementManager.instance.addMeasurement(test1Added);

    // Above should have it's axes turned off after this
    MeasurementPreferences.current.displayMeasurementAxes = false;
    const test2 = new DistanceMeasurement();
    assert.isFalse(test2.showAxes);
    assert.isFalse(test1Added.showAxes);

    // But the original one should be unchanged since we never added it
    assert.isTrue(test1.showAxes);
  });
});
