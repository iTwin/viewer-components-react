/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Point3d } from "@bentley/geometry-core";
import { assert } from "chai";
import { Measurement, MeasurementPickContext } from "../../api/Measurement";
import { WellKnownViewType } from "../../api/MeasurementEnums";
import { AngleMeasurement, AngleMeasurementSerializer } from "../../measurements/AngleMeasurement";
import { MeasureAngleToolModel } from "../../toolmodels/MeasureAngleToolModel";

describe("AngleMeasurement tests", () => {
  it("Test serialization/clone/equals", async () => {
    const measure1 = AngleMeasurement.create(Point3d.create(-1, 0, 0), Point3d.create(0, 1, 0), Point3d.create(1, 0, 0), WellKnownViewType.XSection);
    assert.instanceOf(measure1.serializer, AngleMeasurementSerializer);

    measure1.isLocked = true;
    measure1.groupId = "inactive";
    measure1.subgroupId = "ghosted";
    measure1.id = "5";
    const data = Measurement.serialize(measure1);
    assert.isDefined(data);
    assert.property(data, AngleMeasurementSerializer.angleMeasurementName);

    const jsonString = JSON.stringify(data);
    const jsonData = JSON.parse(jsonString);

    // If pass in a single measurement, expect a single measurement
    const measure2 = Measurement.parse(jsonData) as AngleMeasurement;
    assert.isDefined(measure2);

    assert.isDefined(measure1.startPointRef);
    assert.isDefined(measure1.centerRef);
    assert.isDefined(measure1.endPointRef);
    assert.isDefined(measure2.startPointRef);
    assert.isDefined(measure2.centerRef);
    assert.isDefined(measure2.endPointRef);
    assert.isTrue(measure1.startPointRef!.isAlmostEqual(measure2.startPointRef!));
    assert.isTrue(measure1.centerRef!.isAlmostEqual(measure2.centerRef!));
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
    assert.isTrue(measure3 instanceof AngleMeasurement);
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

  it("Test angle measurement", () => {
    // Create an arc based on three points on the unit circle
    const m = AngleMeasurement.create(Point3d.create(0, 1, 0), Point3d.create(0, 0, 0), Point3d.create(1, 0, 0), WellKnownViewType.XSection);
    // Should be able to get the angle
    assert.isDefined(m.angle);
    // Should have a 90 degrees angle
    assert.approximately(m.angle!, Math.PI / 2, 0.0001);
  });

  it("Test setters", () => {
    const m = AngleMeasurement.create(Point3d.create(0, 1, 0), Point3d.create(0, 0, 0), Point3d.create(1, 0, 0), WellKnownViewType.XSection);
    assert.instanceOf(m, AngleMeasurement);

    assert.isTrue(Point3d.create(0, 1, 0).isAlmostEqual(m.startPointRef!));
    assert.isTrue(Point3d.create(0, 0, 0).isAlmostEqual(m.centerRef!));
    assert.isTrue(Point3d.create(1, 0, 0).isAlmostEqual(m.endPointRef!));

    m.setStartPoint(Point3d.create(0.0, 1.0, 2.0));
    assert.isTrue(Point3d.create(0.0, 1.0, 2.0).isAlmostEqual(m.startPointRef!));

    m.setCenter(Point3d.create(2.0, 3.0, 4.0));
    assert.isTrue(Point3d.create(2.0, 3.0, 4.0).isAlmostEqual(m.centerRef!));

    m.setEndPoint(Point3d.create(4.0, 5.0, 6.0));
    assert.isTrue(Point3d.create(4.0, 5.0, 6.0).isAlmostEqual(m.endPointRef!));
  });

  it("Test MeasureAngleToolModel states", () => {
    const model = new MeasureAngleToolModel();
    assert.lengthOf(model.measurements, 0);
    assert.isUndefined(model.dynamicMeasurement);

    assert.strictEqual(MeasureAngleToolModel.State.SetMeasurementViewport, model.currentState);
    assert.isFalse(model.setStartPoint(WellKnownViewType.Any, Point3d.createZero(), false), "wrong state");
    assert.isFalse(model.setCenter(WellKnownViewType.Any, Point3d.createZero(), false), "wrong state");
    assert.isFalse(model.setEndPoint(WellKnownViewType.Any, Point3d.createZero(), false), "wrong state");
    assert.isTrue(model.setMeasurementViewport(WellKnownViewType.Spatial));

    assert.lengthOf(model.measurements, 0);
    assert.isUndefined(model.dynamicMeasurement);

    // Test SetStartPoint state
    assert.strictEqual(MeasureAngleToolModel.State.SetStartPoint, model.currentState);
    assert.isFalse(model.setMeasurementViewport(WellKnownViewType.Profile), "wrong state");
    assert.isFalse(model.setEndPoint(WellKnownViewType.Spatial, Point3d.createZero(), false), "wrong state");
    assert.isFalse(model.setCenter(WellKnownViewType.Spatial, Point3d.createZero(), false), "wrong state");
    assert.isFalse(model.setStartPoint(WellKnownViewType.Any, Point3d.create(1, 2, 3), false), "MeasurementViewport mismatch");
    assert.isTrue(model.setStartPoint(WellKnownViewType.Spatial, Point3d.create(1, 2, 3), false));

    assert.lengthOf(model.measurements, 0);
    assert.instanceOf(model.dynamicMeasurement, AngleMeasurement);
    assert.isTrue(Point3d.create(1, 2, 3).isAlmostEqual(model.dynamicMeasurement!.startPointRef!));
    assert.isUndefined(model.dynamicMeasurement!.centerRef);
    assert.isUndefined(model.dynamicMeasurement!.endPointRef);

    // Test SetCenter state
    assert.strictEqual(MeasureAngleToolModel.State.SetCenter, model.currentState);
    assert.isFalse(model.setMeasurementViewport(WellKnownViewType.XSection), "wrong state");
    assert.isFalse(model.setStartPoint(WellKnownViewType.XSection, Point3d.createZero(), false), "wrong state");
    assert.isFalse(model.setEndPoint(WellKnownViewType.XSection, Point3d.createZero(), false), "wrong state");
    assert.isFalse(model.setCenter(WellKnownViewType.Profile, Point3d.create(100.0, 0, 0), false), "MeasurementViewport mismatch");
    assert.isTrue(model.setCenter(WellKnownViewType.Spatial, Point3d.create(100.0, 0, 0), false));

    assert.lengthOf(model.measurements, 0);
    assert.instanceOf(model.dynamicMeasurement, AngleMeasurement);

    // Test SetEndPoint state
    assert.strictEqual(MeasureAngleToolModel.State.SetEndPoint, model.currentState);
    assert.isFalse(model.setMeasurementViewport(WellKnownViewType.XSection), "wrong state");
    assert.isFalse(model.setStartPoint(WellKnownViewType.Spatial, Point3d.create(-1, 0, 0), false), "wrong state");
    assert.isFalse(model.setCenter(WellKnownViewType.Spatial, Point3d.create(0, 1, 0), false), "wrong state");
    assert.isFalse(model.setEndPoint(WellKnownViewType.XSection, Point3d.create(1, 0, 0), false), "MeasurementViewport mismatch");
    assert.isTrue(model.setEndPoint(WellKnownViewType.Spatial, Point3d.create(1, 0, 0), false));
    // Should finish measuring and add measurements to the model
    assert.lengthOf(model.measurements, 1);
    assert.isUndefined(model.dynamicMeasurement);
  });

  it("Test MeasureAngleToolModel reset/clear measurements", () => {
    const model = new MeasureAngleToolModel();

    assert.strictEqual(MeasureAngleToolModel.State.SetMeasurementViewport, model.currentState);
    assert.isTrue(model.setMeasurementViewport(WellKnownViewType.Profile));

    assert.strictEqual(MeasureAngleToolModel.State.SetStartPoint, model.currentState);
    model.reset(true);
    assert.strictEqual(MeasureAngleToolModel.State.SetMeasurementViewport, model.currentState);

    assert.isFalse(model.setStartPoint(WellKnownViewType.Profile, Point3d.createZero(), false));
    assert.isTrue(model.setMeasurementViewport(WellKnownViewType.Profile));
    assert.isTrue(model.setStartPoint(WellKnownViewType.Profile, Point3d.createZero(), false));

    assert.strictEqual(MeasureAngleToolModel.State.SetCenter, model.currentState);
    model.reset(false);
    assert.strictEqual(MeasureAngleToolModel.State.SetMeasurementViewport, model.currentState);

    assert.isTrue(model.setMeasurementViewport(WellKnownViewType.Profile));
    assert.isTrue(model.setStartPoint(WellKnownViewType.Profile, Point3d.create(-1, 0, 0), false));
    assert.isTrue(model.setCenter(WellKnownViewType.Profile, Point3d.create(0, 1, 0), false));
    assert.isTrue(model.setEndPoint(WellKnownViewType.Profile, Point3d.create(1, 0, 0), false));

    assert.lengthOf(model.measurements, 1);
    assert.isUndefined(model.dynamicMeasurement);

    assert.strictEqual(MeasureAngleToolModel.State.SetMeasurementViewport, model.currentState);
    model.reset(false);
    assert.strictEqual(MeasureAngleToolModel.State.SetMeasurementViewport, model.currentState);

    assert.lengthOf(model.measurements, 1);
    model.reset(true);
    assert.lengthOf(model.measurements, 0);

    // At this point we're back at initial stage
    assert.isTrue(model.setMeasurementViewport(WellKnownViewType.Profile));
    assert.isTrue(model.setStartPoint(WellKnownViewType.Profile, Point3d.create(-1, 0, 0), false));
    assert.isTrue(model.setCenter(WellKnownViewType.Profile, Point3d.create(0, 1, 0), false));
    assert.isTrue(model.setEndPoint(WellKnownViewType.Profile, Point3d.create(1, 0, 0), false));

    assert.isTrue(model.setMeasurementViewport(WellKnownViewType.Profile));
    assert.isTrue(model.setStartPoint(WellKnownViewType.Profile, Point3d.create(-100, 0, 0), false));
    assert.isTrue(model.setCenter(WellKnownViewType.Profile, Point3d.create(0, 100, 0), false));
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
