/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { vi } from "vitest";
import { Cartographic } from "@itwin/core-common";
import { IModelApp, QuantityType } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { Measurement, MeasurementPickContext } from "../../api/Measurement.js";
import { WellKnownViewType } from "../../api/MeasurementEnums.js";
import { LocationMeasurement, LocationMeasurementSerializer } from "../../measurements/LocationMeasurement.js";
import { MeasureLocationToolModel } from "../../toolmodels/MeasureLocationToolModel.js";

describe("LocationMeasurement tests", () => {
  it("Test serialization/clone/equals", async () => {
    const measure1 = LocationMeasurement.create(Point3d.create(100, 10, 20), WellKnownViewType.XSection);
    assert.instanceOf(measure1.serializer, LocationMeasurementSerializer);

    assert.isTrue(Point3d.create(100, 10, 20).isAlmostEqual(measure1.location));
    measure1.location = Point3d.create(1.0, 2.0, 3.0);
    measure1.slope = 1;
    measure1.offset = 50;
    measure1.station = 500;
    measure1.geoLocation = Cartographic.fromDegrees({ latitude: 25, longitude: 25, height: 100 });
    measure1.isLocked = true;
    measure1.groupId = "inactive";
    measure1.subgroupId = "ghosted";
    measure1.id = "5";
    const data = Measurement.serialize(measure1);
    assert.isDefined(data);
    assert.property(data, LocationMeasurementSerializer.locationMeasurementName);

    const jsonString = JSON.stringify(data);
    const jsonData = JSON.parse(jsonString);

    // If pass in a single measurement, expect a single measurement
    const measure2 = Measurement.parse(jsonData) as LocationMeasurement;
    assert.isDefined(measure2);

    assert.isTrue(measure1.location.isAlmostEqual(measure2.location));
    assert.isTrue(measure1.geoLocation !== undefined && measure2.geoLocation !== undefined);
    assert.isTrue(measure1.geoLocation?.equals(measure2.geoLocation!));
    assert.isDefined(measure2.station);
    assert.isDefined(measure2.offset);
    assert.isDefined(measure2.slope);
    assert.isTrue(measure1.viewTarget.isOfViewType(WellKnownViewType.XSection));
    assert.isTrue(measure1.viewTarget.primary === measure2.viewTarget.primary);
    assert.isTrue(measure1.isLocked === measure2.isLocked);
    assert.isTrue(measure1.groupId === measure2.groupId);
    assert.isTrue(measure1.subgroupId === measure2.subgroupId);
    assert.isTrue(measure1.id === measure2.id);
    assert.isTrue(measure1.equals(measure2));

    // Test equality / cloning
    measure2.location.x = measure2.location.x + 100;
    assert.isFalse(measure1.equals(measure2));

    const measure3 = measure1.clone();
    assert.isTrue(measure3 instanceof LocationMeasurement);
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
      // Create a LocationMeasurement to trigger createTextMarker
      const measurement = LocationMeasurement.create(
        Point3d.create(100, 10, 20),
        WellKnownViewType.XSection
      );

      // Wait for the async createTextMarker to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify that the KoQ lookup was attempted (coordinate is used first in createTextMarker)
      assert.isTrue(getSpecsByNameSpy.mock.calls.length > 0, "getSpecsByName should have been called during construction");
      assert.strictEqual(getSpecsByNameSpy.mock.calls[0][0], "AecUnits.LENGTH_COORDINATE", "Should lookup the default coordinate KoQ string");

      // Verify that the fallback method was called
      assert.isTrue(findFormatterSpecSpy.mock.calls.length > 0, "findFormatterSpecByQuantityType should have been called as fallback");
      assert.strictEqual(findFormatterSpecSpy.mock.calls[0][0], QuantityType.Coordinate, "Should fallback to QuantityType.Coordinate");

      // Verify the measurement was created successfully
      assert.isDefined(measurement);
      assert.isDefined(measurement.location);
      assert.strictEqual(measurement.coordinateKoQ, "AecUnits.LENGTH_COORDINATE");
    } finally {
      // Restore original methods
      IModelApp.quantityFormatter.getSpecsByName = originalGetSpecsByName;
      IModelApp.quantityFormatter.findFormatterSpecByQuantityType = originalFindFormatterSpecByQuantityType;
    }
  });

  it("Test MeasureLocationToolModel reset/clear measurements", () => {
    const model = new MeasureLocationToolModel();
    assert.lengthOf(model.measurements, 0);
    assert.isUndefined(model.dynamicMeasurement);

    model.addLocation({ location: Point3d.create(10, 20, 10), viewType: WellKnownViewType.XSection, slope: 2, station: 100, offset: 50 }, false);
    assert.lengthOf(model.measurements, 1);
    assert.isUndefined(model.dynamicMeasurement);
    assert.isDefined(model.measurements[0].slope);
    assert.isTrue(model.measurements[0].viewTarget.primary === WellKnownViewType.XSection);

    model.addLocation({ location: Point3d.create(100, 50, 0), viewType: WellKnownViewType.Profile }, false);
    assert.lengthOf(model.measurements, 2);
    assert.isTrue(model.measurements[1].viewTarget.primary === WellKnownViewType.Profile);

    assert.isTrue(model.undoMeasurement());
    assert.lengthOf(model.measurements, 1);
    assert.isTrue(model.undoMeasurement());
    assert.lengthOf(model.measurements, 0);
    assert.isFalse(model.undoMeasurement());

    // Try with dynamic measurement
    model.addLocation({ location: Point3d.create(10, 20, 10), viewType: WellKnownViewType.XSection, slope: 2, station: 100, offset: 50 }, true);
    assert.lengthOf(model.measurements, 0);
    assert.isFalse(model.undoMeasurement());
    model.addLocation({ location: Point3d.create(10, 20, 10), viewType: WellKnownViewType.XSection, slope: 2, station: 40, offset: 50 }, true);
    assert.lengthOf(model.measurements, 0);
    assert.isFalse(model.undoMeasurement());
  });
});
