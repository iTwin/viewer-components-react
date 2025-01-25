/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Measurement } from "../../api/Measurement.js";
import { WellKnownMeasurementStyle, WellKnownViewType } from "../../api/MeasurementEnums.js";
import { MeasurementManager } from "../../api/MeasurementManager.js";
import { MeasurementPreferences } from "../../api/MeasurementPreferences.js";
import type { DistanceMeasurementProps } from "../../measurements/DistanceMeasurement.js";
import { DistanceMeasurement } from "../../measurements/DistanceMeasurement.js";
import { DistanceMeasurementSubClass } from "./MeasurementSerialization.test.js";
import { MeasurementActionToolbar } from "../../widgets/MeasurementActionToolbar.js";
import { Point2d } from "@itwin/core-geometry";

describe("Measurement tests", () => {
  it("Test equality, type mismatch", () => {
    const test = new DistanceMeasurement();
    const other = new DistanceMeasurementSubClass();
    const other2 = new DistanceMeasurementSubClass();
    assert.isFalse(test.equals(other));
    assert.isTrue(other.equals(other2));
  });

  it("Test display labels", () => {
    MeasurementPreferences.current.displayMeasurementLabels = true;
    const test = new DistanceMeasurement();
    assert.isTrue(test.displayLabels);
    MeasurementPreferences.current.displayMeasurementLabels = false;
    const test2 = new DistanceMeasurement();
    assert.isFalse(test2.displayLabels);
    MeasurementPreferences.current.displayMeasurementLabels = true;

    const test3 = test2.clone();
    assert.isFalse(test3.displayLabels);

    assert.isTrue(test.equals(test2, { ignoreNonDataState: true }));
    assert.isFalse(test.equals(test2));

    const serialized = test.toJSON<DistanceMeasurementProps>();
    const roundTrip = DistanceMeasurement.fromJSON(serialized);
    assert.isTrue(roundTrip.displayLabels === test.displayLabels);

    const serialized2 = test2.toJSON<DistanceMeasurementProps>();
    const roundTrip2 = DistanceMeasurement.fromJSON(serialized2);
    assert.isTrue(roundTrip2.displayLabels === test2.displayLabels);
  });

  it("Test equality, ignore options", () => {
    const other = new DistanceMeasurementSubClass();
    other.extraProp = 42;
    const other2 = new DistanceMeasurementSubClass();
    other2.extraProp = 42;
    other2.viewTarget.include(WellKnownViewType.XSection);

    assert.isFalse(other.equals(other2));
    assert.isTrue(other.equals(other2, { ignoreViewTarget: true }));

    // Test label equality
    other2.label = "Solution 42";
    assert.isFalse(other.equals(other2, { ignoreViewTarget: true }));
    assert.isTrue(other.equals(other2, { ignoreViewTarget: true, ignoreLabel: true }));
    other2.label = undefined;

    other.id = "5";
    other2.id = "6";
    assert.isFalse(other.equals(other2, { ignoreViewTarget: true }));
    assert.isTrue(other.equals(other2, { ignoreIds: true, ignoreViewTarget: true }));

    other.style = "blah";
    assert.isFalse(other.equals(other2, { ignoreIds: true, ignoreViewTarget: true }));
    assert.isTrue(other.equals(other2, { ignoreStyle: true, ignoreIds: true, ignoreViewTarget: true }));

    other.isLocked = true;
    assert.isFalse(other.equals(other2, { ignoreStyle: true, ignoreIds: true, ignoreViewTarget: true }));
    assert.isTrue(other.equals(other2, { ignoreNonDataState: true, ignoreStyle: true, ignoreIds: true, ignoreViewTarget: true }));

    // The subclass uses the tolerance option to compare, so make it really high and it should pass!
    other.extraProp = 41;
    assert.isFalse(other.equals(other2, { ignoreNonDataState: true, ignoreStyle: true, ignoreIds: true, ignoreViewTarget: true }));
    assert.isTrue(other.equals(other2, { tolerance: 5, ignoreNonDataState: true, ignoreStyle: true, ignoreIds: true, ignoreViewTarget: true }));
  });

  it("Test clone", () => {
    const test = new DistanceMeasurementSubClass();
    test.extraProp = 42;
    test.label = "Solution 42";

    const test2 = test.clone();
    assert.isTrue(test2 instanceof DistanceMeasurementSubClass);
    assert.isTrue((test2 as DistanceMeasurementSubClass).extraProp === test.extraProp);
    assert.isTrue(test2.label === test.label);
  });

  it("Test roundtrip json", () => {
    const test = new DistanceMeasurementSubClass();
    test.extraProp = 42;
    test.label = "Solution 42";

    const jsonProps = Measurement.serialize(test);
    const test2 = Measurement.parseSingle(jsonProps);
    assert.isDefined(test2);
    assert.isTrue(test2 instanceof DistanceMeasurementSubClass);
    assert.isDefined(test2?.label);
    assert.isTrue(test2!.equals(test));
  });

  it("Test styles/locking", () => {
    const test = new DistanceMeasurementSubClass();

    assert.isTrue(test.activeStyle === WellKnownMeasurementStyle.Default);

    test.isLocked = true;

    assert.isTrue(test.activeStyle === WellKnownMeasurementStyle.DefaultLocked);

    test.lockStyle = "blah";
    assert.isTrue(test.activeStyle === "blah");

    test.style = "yada";
    test.isLocked = false;
    assert.isTrue(test.activeStyle === "yada");
  });

  it("Test measurement manager, add/remove", () => {
    const dist = new DistanceMeasurement();
    MeasurementManager.instance.clear();
    MeasurementManager.instance.addMeasurement(dist);
    assert.isTrue(MeasurementManager.instance.measurements.length === 1);

    MeasurementManager.instance.onMeasurementsAdded.addOnce((args: Measurement[]) => {
      assert.isTrue(args.length === 2);
    });

    MeasurementManager.instance.addMeasurement([new DistanceMeasurement(), new DistanceMeasurement()]);
    assert.isTrue(MeasurementManager.instance.measurements.length === 3);

    MeasurementManager.instance.onMeasurementsRemoved.addOnce((args: Measurement[]) => {
      assert.isTrue(args.length === 1);
    });

    const dropped = MeasurementManager.instance.dropMeasurement(dist);
    assert.isTrue(dropped);
    assert.isTrue(MeasurementManager.instance.measurements.length === 2);
  });

  it("Test measurement manager, getMeasurementsForViewType", () => {
    const dist1 = new DistanceMeasurement();
    dist1.viewTarget.include(WellKnownViewType.AnySpatial);
    dist1.viewTarget.exclude(WellKnownViewType.XSection);

    const dist2 = new DistanceMeasurement();
    dist2.viewTarget.include(WellKnownViewType.AnySpatial);

    const dist3 = new DistanceMeasurement();
    dist3.viewTarget.include(WellKnownViewType.AnySpatial);

    const dist4 = new DistanceMeasurement();
    dist4.viewTarget.include(WellKnownViewType.Spatial);

    const dist5 = new DistanceMeasurement();
    dist5.viewTarget.include(WellKnownViewType.Drawing);

    MeasurementManager.instance.clear();
    MeasurementManager.instance.addMeasurement([dist1, dist2, dist3, dist4, dist5]);
    assert.isTrue(MeasurementManager.instance.getMeasurementsForViewType(WellKnownViewType.Any).length === 5);
    assert.isTrue(MeasurementManager.instance.getMeasurementsForViewType(WellKnownViewType.AnyDrawing).length === 1);
    assert.isTrue(MeasurementManager.instance.getMeasurementsForViewType(WellKnownViewType.Drawing).length === 1);
    assert.isTrue(MeasurementManager.instance.getMeasurementsForViewType(WellKnownViewType.XSection).length === 2);
    assert.isTrue(MeasurementManager.instance.getMeasurementsForViewType(WellKnownViewType.AnySpatial).length === 4);
    assert.isTrue(MeasurementManager.instance.getMeasurementsForViewType(WellKnownViewType.Spatial).length === 4);

    assert.isTrue(MeasurementManager.instance.dropMeasurementsForViewType(WellKnownViewType.Spatial).length === 4);

    assert.isTrue(MeasurementManager.instance.measurements.length === 1);
    MeasurementManager.instance.clear();
    assert.isTrue(MeasurementManager.instance.measurements.length === 0);
  });

  it("Test measurement manager, clear locked", () => {
    const test = new DistanceMeasurement();
    test.isLocked = true;

    MeasurementManager.instance.clear();
    MeasurementManager.instance.addMeasurement(test);
    MeasurementManager.instance.clear(false);

    assert.isTrue(MeasurementManager.instance.measurements.length === 1);
    MeasurementManager.instance.clear(true);
    assert.isTrue(MeasurementManager.instance.measurements.length === 0);
  });

  it("Test measurement manager, onCleanup for dropped measurements", () => {
    const test = new CleanupDistanceMeasurement();

    MeasurementManager.instance.clear();
    MeasurementManager.instance.addMeasurement(test);
    MeasurementManager.instance.clear();

    assert.isTrue(test.cleanupCalled);
    test.cleanupCalled = false;

    MeasurementManager.instance.addMeasurement(test);
    MeasurementManager.instance.dropMeasurement(test);

    assert.isTrue(test.cleanupCalled);
    test.cleanupCalled = false;

    MeasurementManager.instance.addMeasurement(test);
    MeasurementManager.instance.dropMeasurementsForPredicate((m) => {
      return m === test;
    });

    assert.isTrue(test.cleanupCalled);
  });

  it("Test measurement allowActions", () => {
    MeasurementActionToolbar.setDefaultActionProvider();
    const didOpen = MeasurementActionToolbar.openToolbar([new NoParticipateMeasurement()], Point2d.create(0, 0));
    assert.isFalse(didOpen);

    const reallyDidOpen = MeasurementActionToolbar.openToolbar([new DistanceMeasurement()], Point2d.create(0, 0));
    assert.isTrue(reallyDidOpen);

    MeasurementActionToolbar.closeToolbar();
    MeasurementActionToolbar.clearActionProviders();
  });
});

class CleanupDistanceMeasurement extends DistanceMeasurement {
  public cleanupCalled = false;

  public override onCleanup() {
    this.cleanupCalled = true;
  }
}

class NoParticipateMeasurement extends DistanceMeasurement {
  public override get allowActions() { return false; }
}
