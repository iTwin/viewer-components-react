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
import { AreaMeasurement, AreaMeasurementSerializer } from "../../measurements/AreaMeasurement.js";
import { MeasureAreaToolModel } from "../../toolmodels/MeasureAreaToolModel.js";

describe("AreaMeasurement tests", () => {
  it("Test serialization/clone/equals", async () => {
    const measure1 = AreaMeasurement.create([Point3d.create(0, 0, 0), Point3d.create(-1, 1, 0), Point3d.create(0, 2, 0)], WellKnownViewType.XSection);
    assert.instanceOf(measure1.serializer, AreaMeasurementSerializer);

    measure1.isLocked = false;
    measure1.groupId = "inactive";
    measure1.subgroupId = undefined;
    measure1.id = "5";
    const data = Measurement.serialize(measure1);
    assert.isDefined(data);
    assert.property(data, AreaMeasurementSerializer.areaMeasurementName);

    const jsonString = JSON.stringify(data);
    const jsonData = JSON.parse(jsonString);

    const measure2 = Measurement.parse(jsonData) as AreaMeasurement;
    assert.isDefined(measure2, jsonData);

    assert.isTrue(measure1.isLocked === measure2.isLocked);
    assert.isTrue(measure1.groupId === measure2.groupId);
    assert.isTrue(measure1.subgroupId === measure2.subgroupId);
    assert.isTrue(measure1.id === measure2.id);
    assert.isTrue(measure1.viewTarget.isOfViewType(WellKnownViewType.XSection));
    assert.isTrue(measure1.viewTarget.primary === measure2.viewTarget.primary);
    assert.isTrue(measure1.polygonPoints.length === measure2.polygonPoints.length);

    const length = measure1.polygonPoints.length;
    for (let i = 0; i < length; i++) {
      const pt1 = measure1.polygonPoints[i];
      const pt2 = measure2.polygonPoints[i];
      assert.isTrue(pt1.isAlmostEqual(pt2));
    }

    // Test equality / cloning
    measure2.polygonPoints[0].x = measure2.polygonPoints[0].x + 100;
    assert.isFalse(measure1.equals(measure2));

    const measure3 = measure1.clone();
    assert.isTrue(measure3 instanceof AreaMeasurement);
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
      // Create an AreaMeasurement with valid polygon to trigger createTextMarker
      const measurement = AreaMeasurement.create(
        [Point3d.create(0, 0, 0), Point3d.create(-1, 1, 0), Point3d.create(0, 2, 0)],
        WellKnownViewType.XSection
      );

      // Wait for the async createTextMarker to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify that the KoQ lookup was attempted (area KoQ is used first in widget data)
      assert.isTrue(getSpecsByNameSpy.mock.calls.length > 0, "getSpecsByName should have been called during construction");
      assert.strictEqual(getSpecsByNameSpy.mock.calls[0][0], "DefaultToolsUnits.AREA", "Should lookup the default area KoQ string");

      // Verify that the fallback method was called
      assert.isTrue(findFormatterSpecSpy.mock.calls.length > 0, "findFormatterSpecByQuantityType should have been called as fallback");
      assert.strictEqual(findFormatterSpecSpy.mock.calls[0][0], QuantityType.Area, "Should fallback to QuantityType.Area");

      // Verify the measurement was created successfully
      assert.isDefined(measurement);
      assert.isDefined(measurement.polygonPoints);
      assert.strictEqual(measurement.areaKoQ, "DefaultToolsUnits.AREA");
    } finally {
      // Restore original methods
      IModelApp.quantityFormatter.getSpecsByName = originalGetSpecsByName;
      IModelApp.quantityFormatter.findFormatterSpecByQuantityType = originalFindFormatterSpecByQuantityType;
    }
  });

  it("Test fallback from getFormatterSpec in setTextToMarker", async () => {
    // Mock getSpecsByName to return undefined (simulating KoQ lookup failure)
    const originalGetSpecsByName = IModelApp.quantityFormatter.getSpecsByName;
    const originalFindFormatterSpecByQuantityType = IModelApp.quantityFormatter.findFormatterSpecByQuantityType;
    const originalFormatQuantity = IModelApp.quantityFormatter.formatQuantity;

    // Create a mock that returns undefined for KoQ lookup
    const getSpecsByNameSpy = vi.fn().mockReturnValue(undefined);
    const findFormatterSpecSpy = vi.fn().mockReturnValue({
      format: { formatTraits: 0 },
      persistenceUnit: { name: "Units.SQ_M" },
    });
    const formatQuantitySpy = vi.fn().mockReturnValue("1.5 m²");

    // Replace the methods with our spies
    IModelApp.quantityFormatter.getSpecsByName = getSpecsByNameSpy;
    IModelApp.quantityFormatter.findFormatterSpecByQuantityType = findFormatterSpecSpy;
    IModelApp.quantityFormatter.formatQuantity = formatQuantitySpy;

    try {
      // Create an AreaMeasurement with valid polygon
      const measurement = AreaMeasurement.create(
        [Point3d.create(0, 0, 0), Point3d.create(1, 0, 0), Point3d.create(1, 1, 0), Point3d.create(0, 1, 0)],
        WellKnownViewType.XSection
      );

      // Clear previous calls from construction
      getSpecsByNameSpy.mockClear();
      findFormatterSpecSpy.mockClear();
      formatQuantitySpy.mockClear();

      // Trigger setTextToMarker by calling recomputeFromPoints
      measurement.polygon.recomputeFromPoints();

      // Wait for any async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify that the KoQ lookup was attempted in setTextToMarker
      assert.isTrue(getSpecsByNameSpy.mock.calls.length > 0, "getSpecsByName should have been called in setTextToMarker");
      assert.strictEqual(getSpecsByNameSpy.mock.calls[0][0], "DefaultToolsUnits.AREA", "Should lookup the area KoQ string in setTextToMarker");

      // Verify that the fallback method was called
      assert.isTrue(findFormatterSpecSpy.mock.calls.length > 0, "findFormatterSpecByQuantityType should have been called as fallback in setTextToMarker");
      assert.strictEqual(findFormatterSpecSpy.mock.calls[0][0], QuantityType.Area, "Should fallback to QuantityType.Area in setTextToMarker");

      // Verify that formatQuantity was called with the fallback spec
      assert.isTrue(formatQuantitySpy.mock.calls.length > 0, "formatQuantity should have been called with fallback spec");

      // Verify the measurement was updated successfully
      assert.isDefined(measurement);
      assert.isDefined(measurement.polygon);
      assert.isDefined(measurement.polygon.textMarker);
    } finally {
      // Restore original methods
      IModelApp.quantityFormatter.getSpecsByName = originalGetSpecsByName;
      IModelApp.quantityFormatter.findFormatterSpecByQuantityType = originalFindFormatterSpecByQuantityType;
      IModelApp.quantityFormatter.formatQuantity = originalFormatQuantity;
    }
  });

  it("Test dynamic", () => {
    const m = AreaMeasurement.create([Point3d.createZero()]);
    assert.instanceOf(m, AreaMeasurement);

    assert.isFalse(m.closeDynamicPolygon());
    assert.isFalse(m.isValidPolygon);
    assert.lengthOf(m.polygonPoints, 1);
  });

  it("Test MeasureAreaToolModel states", () => {
    const model = new MeasureAreaToolModel();
    assert.lengthOf(model.measurements, 0);
    assert.isUndefined(model.dynamicMeasurement);
    assert.isFalse(model.hasEnoughPoints);
    assert.isFalse(model.tryCommitMeasurement());

    assert.strictEqual(MeasureAreaToolModel.State.SetMeasurementViewport, model.currentState);
    assert.isFalse(model.addPoint(WellKnownViewType.Any, Point3d.createZero(), false), "wrong state");
    assert.isFalse(model.addPoint(WellKnownViewType.Any, Point3d.createZero(), true), "wrong state");
    assert.isFalse(model.addPoint(WellKnownViewType.Profile, Point3d.createZero(), true), "wrong state");

    assert.isTrue(model.setMeasurementViewport(WellKnownViewType.Spatial));
    assert.lengthOf(model.measurements, 0);
    assert.isUndefined(model.dynamicMeasurement);

    assert.strictEqual(MeasureAreaToolModel.State.AddPoint, model.currentState);
    assert.isFalse(model.setMeasurementViewport(WellKnownViewType.Profile), "wrong state");
    assert.isFalse(model.addPoint(WellKnownViewType.Profile, Point3d.createZero(), true), "MeasurementViewport mismatch");
    assert.isFalse(model.addPoint(WellKnownViewType.Profile, Point3d.createZero(), false), "MeasurementViewport mismatch");
    assert.isFalse(model.addPoint(WellKnownViewType.Spatial, Point3d.createZero(), true), "First point cannot be dynamic");

    assert.isTrue(model.addPoint(WellKnownViewType.Spatial, Point3d.createZero(), false));
    assert.instanceOf(model.dynamicMeasurement, AreaMeasurement);
    assert.isFalse(model.tryCommitMeasurement());

    assert.strictEqual(MeasureAreaToolModel.State.AddPoint, model.currentState);
    assert.isFalse(model.hasEnoughPoints);
    assert.isTrue(model.addPoint(WellKnownViewType.Spatial, Point3d.create(1.0, 0.0, 0.0), false));
    assert.isFalse(model.hasEnoughPoints);
    assert.isTrue(model.addPoint(WellKnownViewType.Spatial, Point3d.create(1.0, 1.0, 0.0), true));
    assert.isTrue(model.addPoint(WellKnownViewType.Spatial, Point3d.create(1.0, 1.0, 0.0), false));
    assert.isTrue(model.hasEnoughPoints);

    assert.isTrue(model.tryCommitMeasurement());
    assert.lengthOf(model.measurements, 1);
    assert.isUndefined(model.dynamicMeasurement);

    assert.strictEqual(MeasureAreaToolModel.State.SetMeasurementViewport, model.currentState);
    assert.isTrue(model.setMeasurementViewport(WellKnownViewType.Profile));
    assert.isTrue(model.addPoint(WellKnownViewType.Profile, Point3d.createZero(), false));
    assert.isTrue(model.addPoint(WellKnownViewType.Profile, Point3d.create(1.0, 0.0, 0.0), false));
    assert.isTrue(model.addPoint(WellKnownViewType.Profile, Point3d.create(1.0, -1.0, 0.0), false));
    assert.isTrue(model.hasEnoughPoints);
    assert.isTrue(model.addPoint(WellKnownViewType.Profile, Point3d.createZero(), false));
    assert.strictEqual(MeasureAreaToolModel.State.SetMeasurementViewport, model.currentState);
    assert.lengthOf(model.measurements, 2);
    assert.isUndefined(model.dynamicMeasurement);

    assert.isTrue(model.undoMeasurement());
    assert.lengthOf(model.measurements, 1);
    assert.isTrue(model.undoMeasurement());
    assert.lengthOf(model.measurements, 0);
    assert.isFalse(model.undoMeasurement());
  });

  it("Test MeasureAreaToolModel clone measurements", () => {
    const model = new MeasureAreaToolModel();

    assert.isTrue(model.setMeasurementViewport(WellKnownViewType.Any));
    assert.isTrue(model.addPoint(WellKnownViewType.Any, Point3d.createZero(), false));
    assert.isTrue(model.addPoint(WellKnownViewType.Any, Point3d.create(1.0, 0.0, 0.0), false));
    assert.isTrue(model.addPoint(WellKnownViewType.Any, Point3d.create(1.0, 1.0, 0.0), false));
    assert.isTrue(model.tryCommitMeasurement());

    assert.lengthOf(model.measurements, 1);

    model.reset(true);

    assert.isTrue(model.setMeasurementViewport(WellKnownViewType.Any));
    assert.isTrue(model.addPoint(WellKnownViewType.Any, Point3d.createZero(), false));
    assert.isTrue(model.addPoint(WellKnownViewType.Any, Point3d.create(1.0, 0.0, 0.0), false));
    assert.isTrue(model.addPoint(WellKnownViewType.Any, Point3d.create(1.0, 1.0, 0.0), false));
    assert.isTrue(model.tryCommitMeasurement());
    assert.lengthOf(model.measurements, 1);
    model.clearMeasurements();
  });
});
