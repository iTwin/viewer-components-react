/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Point3d } from "@itwin/core-geometry";
import { assert } from "chai";
import { Measurement, MeasurementPickContext } from "../../api/Measurement.js";
import { WellKnownViewType } from "../../api/MeasurementEnums.js";
import { DistanceMeasurement, DistanceMeasurementSerializer } from "../../measurements/DistanceMeasurement.js";
import { MeasureDistanceToolModel } from "../../toolmodels/MeasureDistanceToolModel.js";

describe("DistanceMeasurement tests", () => {
  it("Test serialization/clone/equals", async () => {
    const measure1 = DistanceMeasurement.create(Point3d.create(0, 0, 0), Point3d.create(0, 10, 0), WellKnownViewType.XSection);
    assert.instanceOf(measure1.serializer, DistanceMeasurementSerializer);

    measure1.isLocked = true;
    measure1.groupId = "inactive";
    measure1.subgroupId = "ghosted";
    measure1.id = "5";
    const data = Measurement.serialize(measure1);
    assert.isDefined(data);
    assert.property(data, DistanceMeasurementSerializer.distanceMeasurementName);

    const jsonString = JSON.stringify(data);
    const jsonData = JSON.parse(jsonString);

    // If pass in a single measurement, expect a single measurement
    const measure2 = Measurement.parse(jsonData) as DistanceMeasurement;
    assert.isDefined(measure2);

    assert.isTrue(measure1.startPointRef.isAlmostEqual(measure2.startPointRef));
    assert.isTrue(measure1.endPointRef.isAlmostEqual(measure2.endPointRef));
    assert.isTrue(measure1.viewTarget.isOfViewType(WellKnownViewType.XSection));
    assert.isTrue(measure1.viewTarget.primary === measure2.viewTarget.primary);
    assert.isTrue(measure1.isLocked === measure2.isLocked);
    assert.isTrue(measure1.groupId === measure2.groupId);
    assert.isTrue(measure1.subgroupId === measure2.subgroupId);
    assert.isTrue(measure1.id === measure2.id);
    assert.isTrue(measure1.equals(measure2));

    // Test equality / cloning
    measure2.endPointRef.x = measure2.endPointRef.x + 100;
    assert.isFalse(measure1.equals(measure2));

    const measure3 = measure1.clone();
    assert.isTrue(measure3 instanceof DistanceMeasurement);
    assert.isTrue(measure3.equals(measure1));

    measure1.isDynamic = true;
    assert.isTrue(measure1.isDynamic);

    (measure3 as DistanceMeasurement).showAxes = true;
    // Coverage of some App-oriented function
    const pickContext = MeasurementPickContext.createFromSourceId("Invalid");
    assert.isFalse(measure3.testDecorationHit(pickContext));
    assert.isDefined(measure3.getDecorationGeometry(pickContext));
    assert.isDefined(await measure3.getDataForMeasurementWidget());
    assert.isString(await measure3.getDecorationToolTip(pickContext));
  });

  it("Test setters", () => {
    const m = DistanceMeasurement.create(Point3d.createZero(), Point3d.create(1.0, 2.0, 3.0));
    assert.instanceOf(m, DistanceMeasurement);

    assert.isTrue(Point3d.createZero().isAlmostEqual(m.startPointRef));
    assert.isTrue(Point3d.create(1.0, 2.0, 3.0).isAlmostEqual(m.endPointRef));

    m.setStartPoint(Point3d.create(0.0, 1.0, 2.0));
    assert.isTrue(Point3d.create(0.0, 1.0, 2.0).isAlmostEqual(m.startPointRef));

    m.setEndPoint(Point3d.create(4.0, 5.0, 6.0));
    assert.isTrue(Point3d.create(4.0, 5.0, 6.0).isAlmostEqual(m.endPointRef));

    m.setStartEndPoints(Point3d.create(-1.0, -2.0, -3.0), Point3d.create(5.0, 6.0, 7.0));
    assert.isTrue(Point3d.create(-1.0, -2.0, -3.0).isAlmostEqual(m.startPointRef));
    assert.isTrue(Point3d.create(5.0, 6.0, 7.0).isAlmostEqual(m.endPointRef));
  });

  it("Test MeasureDistanceToolModel states", () => {
    const model = new MeasureDistanceToolModel();
    assert.lengthOf(model.measurements, 0);
    assert.isUndefined(model.dynamicMeasurement);

    assert.strictEqual(MeasureDistanceToolModel.State.SetMeasurementViewport, model.currentState);
    assert.isFalse(model.setStartPoint(WellKnownViewType.Any, Point3d.createZero()), "wrong state");
    assert.isFalse(model.setEndPoint(WellKnownViewType.Any, Point3d.createZero(), true), "wrong state");
    assert.isFalse(model.setEndPoint(WellKnownViewType.Any, Point3d.createZero(), false), "wrong state");
    assert.isTrue(model.setMeasurementViewport(WellKnownViewType.Spatial));

    assert.lengthOf(model.measurements, 0);
    assert.isUndefined(model.dynamicMeasurement);

    assert.strictEqual(MeasureDistanceToolModel.State.SetStartPoint, model.currentState);
    assert.isFalse(model.setMeasurementViewport(WellKnownViewType.Profile), "wrong state");
    assert.isFalse(model.setEndPoint(WellKnownViewType.Spatial, Point3d.createZero(), true), "wrong state");
    assert.isFalse(model.setEndPoint(WellKnownViewType.Spatial, Point3d.createZero(), false), "wrong state");
    assert.isFalse(model.setStartPoint(WellKnownViewType.Any, Point3d.create(1, 2, 3)), "MeasurementViewport mismatch");
    assert.isTrue(model.setStartPoint(WellKnownViewType.Spatial, Point3d.create(1, 2, 3)));

    assert.lengthOf(model.measurements, 0);
    assert.instanceOf(model.dynamicMeasurement, DistanceMeasurement);
    assert.isTrue(Point3d.create(1, 2, 3).isAlmostEqual(model.dynamicMeasurement!.startPointRef));
    assert.isTrue(Point3d.create(1, 2, 3).isAlmostEqual(model.dynamicMeasurement!.endPointRef));

    // Test state with dynamics
    assert.strictEqual(MeasureDistanceToolModel.State.SetEndPoint, model.currentState);
    assert.isFalse(model.setMeasurementViewport(WellKnownViewType.XSection));
    assert.isFalse(model.setStartPoint(WellKnownViewType.XSection, Point3d.createZero()));
    assert.isFalse(model.setEndPoint(WellKnownViewType.Profile, Point3d.create(100.0, 0, 0), true), "MeasurementViewport mismatch");
    assert.isTrue(model.setEndPoint(WellKnownViewType.Spatial, Point3d.create(100.0, 0, 0), true));

    assert.lengthOf(model.measurements, 0);
    assert.instanceOf(model.dynamicMeasurement, DistanceMeasurement);
    assert.isTrue(model.setEndPoint(WellKnownViewType.Spatial, Point3d.create(200.0, 100.0, 0.0), false));
    assert.lengthOf(model.measurements, 1);
    assert.isUndefined(model.dynamicMeasurement);
  });

  it("Test MeasureDistanceToolModel reset/clear measurements", () => {
    const model = new MeasureDistanceToolModel();

    assert.strictEqual(MeasureDistanceToolModel.State.SetMeasurementViewport, model.currentState);
    assert.isTrue(model.setMeasurementViewport(WellKnownViewType.Profile));

    assert.strictEqual(MeasureDistanceToolModel.State.SetStartPoint, model.currentState);
    model.reset(true);
    assert.strictEqual(MeasureDistanceToolModel.State.SetMeasurementViewport, model.currentState);

    assert.isFalse(model.setStartPoint(WellKnownViewType.Profile, Point3d.createZero()));
    assert.isTrue(model.setMeasurementViewport(WellKnownViewType.Profile));
    assert.isTrue(model.setStartPoint(WellKnownViewType.Profile, Point3d.createZero()));

    assert.strictEqual(MeasureDistanceToolModel.State.SetEndPoint, model.currentState);
    model.reset(false);
    assert.strictEqual(MeasureDistanceToolModel.State.SetMeasurementViewport, model.currentState);

    assert.isTrue(model.setMeasurementViewport(WellKnownViewType.Profile));
    assert.isTrue(model.setStartPoint(WellKnownViewType.Profile, Point3d.createZero()));
    assert.isTrue(model.setEndPoint(WellKnownViewType.Profile, Point3d.create(1, 2, 3), false));

    assert.lengthOf(model.measurements, 1);
    assert.isUndefined(model.dynamicMeasurement);

    assert.strictEqual(MeasureDistanceToolModel.State.SetMeasurementViewport, model.currentState);
    model.reset(false);
    assert.strictEqual(MeasureDistanceToolModel.State.SetMeasurementViewport, model.currentState);

    assert.lengthOf(model.measurements, 1);
    model.reset(true);
    assert.lengthOf(model.measurements, 0);

    // At this point we're back at initial stage
    assert.isTrue(model.setMeasurementViewport(WellKnownViewType.Profile));
    assert.isTrue(model.setStartPoint(WellKnownViewType.Profile, Point3d.createZero()));
    assert.isTrue(model.setEndPoint(WellKnownViewType.Profile, Point3d.create(1, 2, 3), false));

    assert.isTrue(model.setMeasurementViewport(WellKnownViewType.Profile));
    assert.isTrue(model.setStartPoint(WellKnownViewType.Profile, Point3d.create(100, 0, 0)));
    assert.isTrue(model.setEndPoint(WellKnownViewType.Profile, Point3d.create(200, 0, 0), false));

    assert.lengthOf(model.measurements, 2);
    assert.isUndefined(model.dynamicMeasurement);

    assert.isTrue(model.undoMeasurement());
    assert.lengthOf(model.measurements, 1);
    assert.isTrue(model.undoMeasurement());
    assert.lengthOf(model.measurements, 0);
    assert.isFalse(model.undoMeasurement());
  });
});
