/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import type { Measurement } from "../../api/Measurement.js";
import { MeasurementManager } from "../../api/MeasurementManager.js";
import { MeasurementUIEvents } from "../../api/MeasurementUIEvents.js";
import { AreaMeasurement } from "../../measurements/AreaMeasurement.js";
import { DistanceMeasurement } from "../../measurements/DistanceMeasurement.js";

describe("MeasurementUIEvents tests", () => {
  it("Test isToggleMeasurementAxesButtonVisible", () => {
    const test1 = new DistanceMeasurement();

    MeasurementManager.instance.clear();

    assert.isFalse(MeasurementUIEvents.isToggleMeasurementAxesButtonVisible);
    MeasurementManager.instance.addMeasurement(new AreaMeasurement());
    assert.isFalse(MeasurementUIEvents.isToggleMeasurementAxesButtonVisible);

    MeasurementManager.instance.addMeasurement(test1);
    assert.isTrue(MeasurementUIEvents.isToggleMeasurementAxesButtonVisible);

    // Add custom handler, switch it where area measurements show axes
    MeasurementManager.instance.dropMeasurement(test1);

    MeasurementUIEvents.showToggleMeasurementAxesHandler = (args: Measurement) => {
      if (args instanceof AreaMeasurement)
        return true;

      return false;
    };
    MeasurementUIEvents.notifyMeasurementsChanged();

    assert.isTrue(MeasurementUIEvents.isToggleMeasurementAxesButtonVisible);
    MeasurementUIEvents.showToggleMeasurementAxesHandler = undefined;
    MeasurementManager.instance.clear();
  });

  it("Test isClearMeasurementButtonVisible", () => {
    const test1 = new DistanceMeasurement();
    test1.isLocked = true;

    MeasurementManager.instance.clear();

    // Visible with the one non-locked measurement
    assert.isFalse(MeasurementUIEvents.isClearMeasurementButtonVisible);
    MeasurementManager.instance.addMeasurement(new AreaMeasurement());
    assert.isTrue(MeasurementUIEvents.isClearMeasurementButtonVisible);

    MeasurementManager.instance.addMeasurement(test1);

    // Not visible when removed the one non-locked measurement
    MeasurementManager.instance.clear(false);
    assert.isFalse(MeasurementUIEvents.isClearMeasurementButtonVisible);

    // Add custom handler, switch it where measurements have groupID of something to not be cleared
    const test2 = new DistanceMeasurement();
    test2.groupId = "lockedGroup";

    MeasurementUIEvents.shouldClearMeasurementHandler = (args: Measurement) => {
      if (args.groupId === "lockedGroup")
        return true;

      return false;
    };

    MeasurementUIEvents.notifyMeasurementsChanged();

    // Should now be visible, despite a locked measurement
    assert.isFalse(MeasurementUIEvents.isClearMeasurementButtonVisible);

    MeasurementManager.instance.addMeasurement(test2);
    assert.isTrue(MeasurementUIEvents.isClearMeasurementButtonVisible);
  });
});
