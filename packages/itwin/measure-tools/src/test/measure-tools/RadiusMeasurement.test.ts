/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { vi } from "vitest";
import { IModelApp, QuantityType } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { Measurement, MeasurementPickContext } from "../../api/Measurement.js";
import { WellKnownViewType } from "../../api/MeasurementEnums.js";
import { RadiusMeasurement, RadiusMeasurementSerializer } from "../../measurements/RadiusMeasurement.js";
import { MeasureRadiusToolModel } from "../../toolmodels/MeasureRadiusToolModel.js";

describe("RadiusMeasurement tests", () => {
  it("Test serialization/clone/equals", async () => {
    const measure1 = RadiusMeasurement.create(Point3d.create(-1, 0, 0), Point3d.create(0, 1, 0), Point3d.create(1, 0, 0), WellKnownViewType.XSection);
    assert.instanceOf(measure1.serializer, RadiusMeasurementSerializer);

    measure1.isLocked = true;
    measure1.groupId = "inactive";
    measure1.subgroupId = "ghosted";
    measure1.id = "5";
    const data = Measurement.serialize(measure1);
    assert.isDefined(data);
    assert.property(data, RadiusMeasurementSerializer.radiusMeasurementName);

    const jsonString = JSON.stringify(data);
    const jsonData = JSON.parse(jsonString);

    // If pass in a single measurement, expect a single measurement
    const measure2 = Measurement.parse(jsonData) as RadiusMeasurement;
    assert.isDefined(measure2);

    assert.isDefined(measure1.startPointRef);
    assert.isDefined(measure1.midPointRef);
    assert.isDefined(measure1.endPointRef);
    assert.isDefined(measure2.startPointRef);
    assert.isDefined(measure2.midPointRef);
    assert.isDefined(measure2.endPointRef);
    assert.isTrue(measure1.startPointRef!.isAlmostEqual(measure2.startPointRef!));
    assert.isTrue(measure1.midPointRef!.isAlmostEqual(measure2.midPointRef!));
    assert.isTrue(measure1.endPointRef!.isAlmostEqual(measure2.endPointRef!));
    assert.isTrue(measure1.viewTarget.isOfViewType(WellKnownViewType.XSection));
    assert.isTrue(measure1.viewTarget.primary === measure2.viewTarget.primary);
    assert.isTrue(measure1.isLocked === measure2.isLocked);
    assert.isTrue(measure1.groupId === measure2.groupId);
    assert.isTrue(measure1.subgroupId === measure2.subgroupId);
    assert.isTrue(measure1.id === measure2.id);
    assert.isTrue(measure1.equals(measure2));

    // Test equality / cloning
    measure2.endPointRef!.x = measure2.endPointRef!.x + 100;
    assert.isFalse(measure1.equals(measure2));

    const measure3 = measure1.clone();
    assert.isTrue(measure3 instanceof RadiusMeasurement);
    assert.isTrue(measure3.equals(measure1));

    measure1.isDynamic = true;
    assert.isTrue(measure1.isDynamic);

    // Coverage of some App-oriented function
    const pickContext = MeasurementPickContext.createFromSourceId("Invalid");
    assert.isFalse(measure3.testDecorationHit(pickContext));
    assert.isDefined(measure3.getDecorationGeometry(pickContext));
    assert.isDefined(await measure3.getDataForMeasurementWidget());
    assert.isString(await measure3.getDecorationToolTip(pickContext));
  });

  it("Test fallback from getFormatterSpec on construction", async () => {
    // Mock getSpecsByName to return undefined (simulating KoQ lookup failure)
    const originalGetSpecsByName = IModelApp.quantityFormatter.getSpecsByName;
    const originalFindFormatterSpecByQuantityType = IModelApp.quantityFormatter.findFormatterSpecByQuantityType;

    // Create a mock that returns undefined for KoQ lookup
    const getSpecsByNameSpy = vi.fn().mockReturnValue(undefined);
    const findFormatterSpecSpy = vi.fn().mockReturnValue({
      format: { formatTraits: 0 },
      persistenceUnit: { name: "Units.M" },
      applyFormatting: vi.fn().mockReturnValue("mockedFormattedValue")
    });

    // Replace the methods with our spies
    IModelApp.quantityFormatter.getSpecsByName = getSpecsByNameSpy;
    IModelApp.quantityFormatter.findFormatterSpecByQuantityType = findFormatterSpecSpy;

    try {
      // Create a RadiusMeasurement with complete arc data to trigger createTextMarker
      const measurement = RadiusMeasurement.create(
        Point3d.create(-1, 0, 0),
        Point3d.create(0, 1, 0),
        Point3d.create(1, 0, 0),
        WellKnownViewType.XSection
      );

      // Wait for the async createTextMarker to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify that the KoQ lookup was attempted
      assert.isTrue(getSpecsByNameSpy.mock.calls.length > 0, "getSpecsByName should have been called during construction");
      assert.strictEqual(getSpecsByNameSpy.mock.calls[0][0], "DefaultToolsUnits.LENGTH", "Should lookup the default KoQ string");

      // Verify that the fallback method was called
      assert.isTrue(findFormatterSpecSpy.mock.calls.length > 0, "findFormatterSpecByQuantityType should have been called as fallback");
      assert.strictEqual(findFormatterSpecSpy.mock.calls[0][0], QuantityType.LengthEngineering, "Should fallback to QuantityType.LengthEngineering");

      // Verify the measurement was created successfully
      assert.isDefined(measurement);
      assert.isDefined(measurement.arcRef);
      assert.strictEqual(measurement.lengthKoQ, "DefaultToolsUnits.LENGTH");
    } finally {
      // Restore original methods
      IModelApp.quantityFormatter.getSpecsByName = originalGetSpecsByName;
      IModelApp.quantityFormatter.findFormatterSpecByQuantityType = originalFindFormatterSpecByQuantityType;
    }
  });

  it("Test radius measurement", () => {
    // Create an arc based on three points on the unit circle
    const m = RadiusMeasurement.create(Point3d.create(-1, 0, 0), Point3d.create(0, 1, 0), Point3d.create(1, 0, 0), WellKnownViewType.XSection);
    // Should have created an arc and have the correct radius
    assert.isDefined(m.arcRef);
    assert.isDefined(m.radius);
    assert.equal(m.radius, 1);
  });

  it("Test setters", () => {
    const m = RadiusMeasurement.create(Point3d.create(-1, 0, 0), Point3d.create(0, 1, 0), Point3d.create(1, 0, 0), WellKnownViewType.XSection);
    assert.instanceOf(m, RadiusMeasurement);

    assert.isTrue(Point3d.create(-1, 0, 0).isAlmostEqual(m.startPointRef!));
    assert.isTrue(Point3d.create(0, 1, 0).isAlmostEqual(m.midPointRef!));
    assert.isTrue(Point3d.create(1, 0, 0).isAlmostEqual(m.endPointRef!));

    m.setStartPoint(Point3d.create(0.0, 1.0, 2.0));
    assert.isTrue(Point3d.create(0.0, 1.0, 2.0).isAlmostEqual(m.startPointRef!));

    m.setMidPoint(Point3d.create(2.0, 3.0, 4.0));
    assert.isTrue(Point3d.create(2.0, 3.0, 4.0).isAlmostEqual(m.midPointRef!));

    m.setEndPoint(Point3d.create(4.0, 5.0, 6.0));
    assert.isTrue(Point3d.create(4.0, 5.0, 6.0).isAlmostEqual(m.endPointRef!));
  });

  it("Test MeasureRadiusToolModel states", () => {
    const model = new MeasureRadiusToolModel();
    assert.lengthOf(model.measurements, 0);
    assert.isUndefined(model.dynamicMeasurement);

    assert.strictEqual(MeasureRadiusToolModel.State.SetMeasurementViewport, model.currentState);
    assert.isFalse(model.setStartPoint(WellKnownViewType.Any, Point3d.createZero(), false), "wrong state");
    assert.isFalse(model.setMidPoint(WellKnownViewType.Any, Point3d.createZero(), false), "wrong state");
    assert.isFalse(model.setEndPoint(WellKnownViewType.Any, Point3d.createZero(), false), "wrong state");
    assert.isTrue(model.setMeasurementViewport(WellKnownViewType.Spatial));

    assert.lengthOf(model.measurements, 0);
    assert.isUndefined(model.dynamicMeasurement);

    // Test SetStartPoint state
    assert.strictEqual(MeasureRadiusToolModel.State.SetStartPoint, model.currentState);
    assert.isFalse(model.setMeasurementViewport(WellKnownViewType.Profile), "wrong state");
    assert.isFalse(model.setEndPoint(WellKnownViewType.Spatial, Point3d.createZero(), false), "wrong state");
    assert.isFalse(model.setMidPoint(WellKnownViewType.Spatial, Point3d.createZero(), false), "wrong state");
    assert.isFalse(model.setStartPoint(WellKnownViewType.Any, Point3d.create(1, 2, 3), false), "MeasurementViewport mismatch");
    assert.isTrue(model.setStartPoint(WellKnownViewType.Spatial, Point3d.create(1, 2, 3), false));

    assert.lengthOf(model.measurements, 0);
    assert.instanceOf(model.dynamicMeasurement, RadiusMeasurement);
    const dynamicMeasurement = model.dynamicMeasurement as RadiusMeasurement;
    assert.isTrue(Point3d.create(1, 2, 3).isAlmostEqual(dynamicMeasurement.startPointRef!));
    assert.isUndefined(dynamicMeasurement.midPointRef);
    assert.isUndefined(dynamicMeasurement.endPointRef);

    // Test SetMidPoint state
    assert.strictEqual(MeasureRadiusToolModel.State.SetMidPoint, model.currentState);
    assert.isFalse(model.setMeasurementViewport(WellKnownViewType.XSection), "wrong state");
    assert.isFalse(model.setStartPoint(WellKnownViewType.XSection, Point3d.createZero(), false), "wrong state");
    assert.isFalse(model.setEndPoint(WellKnownViewType.XSection, Point3d.createZero(), false), "wrong state");
    assert.isFalse(model.setMidPoint(WellKnownViewType.Profile, Point3d.create(100.0, 0, 0), false), "MeasurementViewport mismatch");
    assert.isTrue(model.setMidPoint(WellKnownViewType.Spatial, Point3d.create(100.0, 0, 0), false));

    assert.lengthOf(model.measurements, 0);
    assert.instanceOf(model.dynamicMeasurement, RadiusMeasurement);

    // Test SetEndPoint state
    assert.strictEqual(MeasureRadiusToolModel.State.SetEndPoint, model.currentState);
    assert.isFalse(model.setMeasurementViewport(WellKnownViewType.XSection), "wrong state");
    assert.isFalse(model.setStartPoint(WellKnownViewType.Spatial, Point3d.create(-1, 0, 0), false), "wrong state");
    assert.isFalse(model.setMidPoint(WellKnownViewType.Spatial, Point3d.create(0, 1, 0), false), "wrong state");
    assert.isFalse(model.setEndPoint(WellKnownViewType.XSection, Point3d.create(1, 0, 0), false), "MeasurementViewport mismatch");
    assert.isTrue(model.setEndPoint(WellKnownViewType.Spatial, Point3d.create(1, 0, 0), false));
    // Should finish measuring and add measurements to the model
    assert.lengthOf(model.measurements, 1);
    assert.isUndefined(model.dynamicMeasurement);
  });

  it("Test MeasureRadiusToolModel reset/clear measurements", () => {
    const model = new MeasureRadiusToolModel();

    assert.strictEqual(MeasureRadiusToolModel.State.SetMeasurementViewport, model.currentState);
    assert.isTrue(model.setMeasurementViewport(WellKnownViewType.Profile));

    assert.strictEqual(MeasureRadiusToolModel.State.SetStartPoint, model.currentState);
    model.reset(true);
    assert.strictEqual(MeasureRadiusToolModel.State.SetMeasurementViewport, model.currentState);

    assert.isFalse(model.setStartPoint(WellKnownViewType.Profile, Point3d.createZero(), false));
    assert.isTrue(model.setMeasurementViewport(WellKnownViewType.Profile));
    assert.isTrue(model.setStartPoint(WellKnownViewType.Profile, Point3d.createZero(), false));

    assert.strictEqual(MeasureRadiusToolModel.State.SetMidPoint, model.currentState);
    model.reset(false);
    assert.strictEqual(MeasureRadiusToolModel.State.SetMeasurementViewport, model.currentState);

    assert.isTrue(model.setMeasurementViewport(WellKnownViewType.Profile));
    assert.isTrue(model.setStartPoint(WellKnownViewType.Profile, Point3d.create(-1, 0, 0), false));
    assert.isTrue(model.setMidPoint(WellKnownViewType.Profile, Point3d.create(0, 1, 0), false));
    assert.isTrue(model.setEndPoint(WellKnownViewType.Profile, Point3d.create(1, 0, 0), false));

    assert.lengthOf(model.measurements, 1);
    assert.isUndefined(model.dynamicMeasurement);

    assert.strictEqual(MeasureRadiusToolModel.State.SetMeasurementViewport, model.currentState);
    model.reset(false);
    assert.strictEqual(MeasureRadiusToolModel.State.SetMeasurementViewport, model.currentState);

    assert.lengthOf(model.measurements, 1);
    model.reset(true);
    assert.lengthOf(model.measurements, 0);

    // At this point we're back at initial stage
    assert.isTrue(model.setMeasurementViewport(WellKnownViewType.Profile));
    assert.isTrue(model.setStartPoint(WellKnownViewType.Profile, Point3d.create(-1, 0, 0), false));
    assert.isTrue(model.setMidPoint(WellKnownViewType.Profile, Point3d.create(0, 1, 0), false));
    assert.isTrue(model.setEndPoint(WellKnownViewType.Profile, Point3d.create(1, 0, 0), false));

    assert.isTrue(model.setMeasurementViewport(WellKnownViewType.Profile));
    assert.isTrue(model.setStartPoint(WellKnownViewType.Profile, Point3d.create(-100, 0, 0), false));
    assert.isTrue(model.setMidPoint(WellKnownViewType.Profile, Point3d.create(0, 100, 0), false));
    assert.isTrue(model.setEndPoint(WellKnownViewType.Profile, Point3d.create(100, 0, 0), false));

    assert.lengthOf(model.measurements, 2);
    assert.isUndefined(model.dynamicMeasurement);

    assert.isTrue(model.undoMeasurement());
    assert.lengthOf(model.measurements, 1);
    assert.isTrue(model.undoMeasurement());
    assert.lengthOf(model.measurements, 0);
    assert.isFalse(model.undoMeasurement());
  });
});
