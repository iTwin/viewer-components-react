/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Geometry, Point3d } from "@itwin/core-geometry";
import { assert } from "chai";
import type { MeasurementEqualityOptions } from "../../api/Measurement.js";
import { Measurement } from "../../api/Measurement.js";
import { WellKnownViewType } from "../../api/MeasurementEnums.js";
import type { MeasurementProps } from "../../api/MeasurementProps.js";
import { AreaMeasurement, AreaMeasurementSerializer } from "../../measurements/AreaMeasurement.js";
import type { DistanceMeasurementProps } from "../../measurements/DistanceMeasurement.js";
import { DistanceMeasurement, DistanceMeasurementSerializer } from "../../measurements/DistanceMeasurement.js";
import { LocationMeasurement, LocationMeasurementSerializer } from "../../measurements/LocationMeasurement.js";

function assertIsArrayWithCount(json: any, ofLength: number) {
  assert.isArray(json);

  const jsonArray = json as any[];
  assert.isTrue(jsonArray.length === ofLength);
}

describe("Measurement Serialization tests", () => {
  it("Test serializer registration", () => {
    // Base types should have registered their serializers. And there is forced uniqueness based on names, once a serializer is added it cannot be dropped.
    assert.isDefined(Measurement.findSerializer(DistanceMeasurementSerializer.distanceMeasurementName));
    assert.throws(() => {
      Measurement.registerSerializer(new DistanceMeasurementSerializer());
    });
  });

  it("Test serializer subclassing", () => {
    const distSub1 = new DistanceMeasurementSubClass();
    distSub1.setStartPoint(Point3d.create(52, 100, 5));
    distSub1.extraProp = 42;

    const json = Measurement.serialize(distSub1);
    assert.isTrue(json.hasOwnProperty(DistanceMeasurementSubclassSerializer.distanceMeasurementSubclassName));

    const distSub2 = Measurement.parseSingle(json);
    assert.isDefined(distSub2);
    assert.isTrue(distSub2 instanceof DistanceMeasurementSubClass);
    assert.isTrue((distSub2 as DistanceMeasurementSubClass).extraProp === distSub1.extraProp);
    assert.isTrue((distSub2 as DistanceMeasurementSubClass).startPointRef.isAlmostEqual(distSub1.startPointRef));
    assert.isTrue(distSub2?.equals(distSub1)); // Test out the equality function too
  });

  it("Test bad serialization inputs", () => {
    let shouldBeUndefined = Measurement.parse(undefined);
    assert.isUndefined(shouldBeUndefined);

    shouldBeUndefined = Measurement.parse("hello world");
    assert.isUndefined(shouldBeUndefined);

    // Valid data for distance measurement, but should have a property name
    shouldBeUndefined = Measurement.parse({ startPoint: [0, 1, 2], endPoint: [0, 1, 2] });
    assert.isUndefined(shouldBeUndefined);

    const dist = Measurement.parse({ distanceMeasurement: { startPoint: [0, 1, 2], endPoint: [0, 1, 2] } });
    assert.instanceOf(dist, DistanceMeasurement);
  });

  it("Test serialize single type in single object", () => {

    const toSerialize = new DistanceMeasurement();
    const json = Measurement.serialize(toSerialize);

    assert.isDefined(json);
    assert.isNotArray(json);
    assert.isTrue(json.hasOwnProperty(DistanceMeasurementSerializer.distanceMeasurementName));

    const parsed = Measurement.parse(json);
    assert.isDefined(parsed);
    assert.isNotArray(parsed);
    assert.isTrue(parsed instanceof DistanceMeasurement);
  });

  it("Test serialize single type in an array", () => {
    const arrayToSerialize = [];
    arrayToSerialize.push(new LocationMeasurement());
    arrayToSerialize.push(new LocationMeasurement());
    arrayToSerialize.push(new LocationMeasurement());

    const json = Measurement.serialize(arrayToSerialize);
    assert.isDefined(json);
    assert.isNotArray(json);
    assert.isTrue(json.hasOwnProperty(LocationMeasurementSerializer.locationMeasurementName));
    assert.isArray(json[LocationMeasurementSerializer.locationMeasurementName]);
    assert.isTrue(json[LocationMeasurementSerializer.locationMeasurementName].length === 3);

    const parsedSingle = Measurement.parseSingle(json);
    assert.isDefined(parsedSingle);
    assert.isNotArray(parsedSingle);
    assert.isTrue(parsedSingle instanceof LocationMeasurement);

    const parsed = Measurement.parse(json);
    assert.isDefined(parsed);
    assert.isArray(parsed);

    const parsedArray = parsed as Measurement[];
    assert.isTrue(parsedArray.length === arrayToSerialize.length);

    for (const m of parsedArray)
      assert.isTrue(m instanceof LocationMeasurement);
  });

  it("Test serialize multiple types in an array", () => {
    const arrayToSerialize = [];
    arrayToSerialize.push(new DistanceMeasurement());
    arrayToSerialize.push(new DistanceMeasurementSubClass());
    arrayToSerialize.push(new DistanceMeasurementSubClass());
    arrayToSerialize.push(new AreaMeasurement());
    arrayToSerialize.push(new LocationMeasurement());
    arrayToSerialize.push(new LocationMeasurement());
    arrayToSerialize.push(new LocationMeasurement());

    const json = Measurement.serialize(arrayToSerialize);
    assert.isDefined(json);
    assert.isArray(json);

    const jsonArray = json as any[];
    assert.isTrue(jsonArray.length === 4);

    // Validate json is as expected

    for (const entry of jsonArray) {
      if (entry.hasOwnProperty(DistanceMeasurementSerializer.distanceMeasurementName)) {
        // Only one instance, so should not be an array of objects
        assert.isNotArray(entry[DistanceMeasurementSerializer.distanceMeasurementName]);
        assert.isDefined(entry[DistanceMeasurementSerializer.distanceMeasurementName]);
      } else if (entry.hasOwnProperty(DistanceMeasurementSubclassSerializer.distanceMeasurementSubclassName)) {
        assertIsArrayWithCount(entry[DistanceMeasurementSubclassSerializer.distanceMeasurementSubclassName], 2);
      } else if (entry.hasOwnProperty(AreaMeasurementSerializer.areaMeasurementName)) {
        // Only one instance, so should not be an array of objects
        assert.isNotArray(entry[AreaMeasurementSerializer.areaMeasurementName]);
        assert.isDefined(entry[AreaMeasurementSerializer.areaMeasurementName]);
      } else if (entry.hasOwnProperty(LocationMeasurementSerializer.locationMeasurementName)) {
        assertIsArrayWithCount(entry[LocationMeasurementSerializer.locationMeasurementName], 3);
      } else {
        assert.isFalse(true); // Should not happen
      }
    }

    const parsed = Measurement.parse(json);
    assert.isDefined(parsed);
    assert.isArray(parsed);

    const parsedArray = parsed as Measurement[];
    assert.isTrue(parsedArray.length === arrayToSerialize.length);

    // Validate we have the same number of measurements and types

    let distCount = 0, distSubClassCount = 0, areaCount = 0, locCount = 0;

    for (const p of parsedArray) {
      if (p instanceof DistanceMeasurementSubClass) {
        distSubClassCount++;
      } else if (p instanceof DistanceMeasurement) {
        distCount++;
      } else if (p instanceof AreaMeasurement) {
        areaCount++;
      } else if (p instanceof LocationMeasurement) {
        locCount++;
      }
    }

    assert.isTrue(distCount === 1);
    assert.isTrue(distSubClassCount === 2);
    assert.isTrue(areaCount === 1);
    assert.isTrue(locCount === 3);
  });

  it("Test serialize multiple types in single object", () => {
    const distM = new DistanceMeasurement();
    const locM = new LocationMeasurement();

    const distJson = Measurement.serialize([distM, distM, distM]);
    const locJson = Measurement.serialize(locM);

    assert.isArray(distJson.distanceMeasurement);
    assert.isTrue(distJson.distanceMeasurement.length === 3);
    assert.isNotArray(locJson.locationMeasurement);

    // Should have a single json object now that as "distanceMeasurement" with an array of 3 objects and "locationMeasurement" with a single object.
    const singleJson = { ...distJson, ...locJson };

    const parsed = Measurement.parse(singleJson);
    assert.isDefined(parsed);
    assert.isArray(parsed);

    const parsedArray = parsed as Measurement[];
    assert.isTrue(parsedArray.length === 4);

    let distCount = 0, locCount = 0;
    for (const m of parsedArray) {
      if (m instanceof DistanceMeasurement) {
        distCount++;
      } else if (m instanceof LocationMeasurement) {
        locCount++;
      } else {
        assert.isTrue(false); // Should not happen
      }
    }

    assert.isTrue(distCount === 3);
    assert.isTrue(locCount === 1);
  });

  it("Distance - Parse legacy json", () => {
    const jsonStr = '{"distanceMeasurement":{"version":3,"startPoint":[70890.51458092594,1210069.0133838505,0],"endPoint":[71004.49564447837,1210091.8913034166,0],"viewportType":1,"showAxes":true,"isLocked":false}}';
    const measure = Measurement.parseSingle(JSON.parse(jsonStr));
    assert.isDefined(measure);
    assert.isTrue(measure instanceof DistanceMeasurement);
    assert.isTrue(measure!.viewTarget.primary === WellKnownViewType.Spatial);

    const distMeasure = measure as DistanceMeasurement;
    assert.isTrue(distMeasure.startPointRef.isAlmostEqual(Point3d.create(70890.51458092594, 1210069.0133838505, 0)));
    assert.isTrue(distMeasure.endPointRef.isAlmostEqual(Point3d.create(71004.49564447837, 1210091.8913034166, 0)));
    assert.isTrue(distMeasure.showAxes);
  });

  it("Area - Parse legacy json", () => {
    const jsonStr = '{"areaMeasurement":{"version":2,"viewportType":1,"polygonPoints":[[70845.57581034972,1209907.642344054,0],[70926.8741316649,1209936.2397435117,0],[70943.62403706148,1209866.7889162574,0],[70857.01477013277,1209864.7462448676,0],[70845.57581034972,1209907.642344054,0]],"isLocked":false}}';
    const measure = Measurement.parseSingle(JSON.parse(jsonStr));
    assert.isDefined(measure);
    assert.isTrue(measure instanceof AreaMeasurement);
    assert.isTrue(measure!.viewTarget.primary === WellKnownViewType.Spatial);

    const areaMeasure = measure as AreaMeasurement;
    assert.isTrue(areaMeasure.polygonPoints.length === 5);
    assert.isTrue(areaMeasure.polygonPoints[0].isAlmostEqual(Point3d.create(70845.57581034972, 1209907.642344054, 0)));
    assert.isTrue(areaMeasure.polygonPoints[1].isAlmostEqual(Point3d.create(70926.8741316649, 1209936.2397435117, 0)));
  });

  it("Location - Parse legacy json", () => {
    const jsonStr = '{"locationMeasurement":{"version":1,"location":[71243.07966281034,1210021.6234076065,0],"geoLocation":{"latitude":0.7757382221073379,"longitude":-1.4953775926575128,"height":0},"isLocked":false}}';
    const measure = Measurement.parseSingle(JSON.parse(jsonStr));
    assert.isDefined(measure);
    assert.isTrue(measure instanceof LocationMeasurement);
    assert.isTrue(measure!.viewTarget.primary === WellKnownViewType.Spatial); // Location's had MainOnly hardcoded, so we want to make sure if no viewTarget it gets set to Spatial

    const locMeasure = measure as LocationMeasurement;
    assert.isTrue(locMeasure.location.isAlmostEqual(Point3d.create(71243.07966281034, 1210021.6234076065, 0)));
    assert.isDefined(locMeasure.geoLocation);
    assert.isTrue(locMeasure.geoLocation!.equalsEpsilon({ latitude: 0.7757382221073379, longitude: -1.4953775926575128, height: 0 }, Geometry.smallAngleRadians));
  });

  it("CivilSnapshot - Parse Legacy json [Multiple types in an array, each entry a single measurement]", () => {
    // 1 area, 2 distance, 2 location, and a station offset (which will be ignored since it's a civil specific measurement)
    const civilSnapshotJsonStr = '{"version":1,"measurements":[{"distanceMeasurement":{"version":3,"startPoint":[70890.51458092594,1210069.0133838505,0],"endPoint":[71004.49564447837,1210091.8913034166,0],"viewportType":1,"showAxes":false,"isLocked":false}},{"distanceMeasurement":{"version":3,"startPoint":[71035.54424960377,1210039.598915837,0],"endPoint":[71140.94609331891,1210077.592603688,0],"viewportType":1,"showAxes":false,"isLocked":false}},{"areaMeasurement":{"version":2,"viewportType":1,"polygonPoints":[[70845.57581034972,1209907.642344054,0],[70926.8741316649,1209936.2397435117,0],[70943.62403706148,1209866.7889162574,0],[70857.01477013277,1209864.7462448676,0],[70845.57581034972,1209907.642344054,0]],"isLocked":false}},{"locationMeasurement":{"version":1,"location":[71080.89155445796,1209984.0382540335,0],"geoLocation":{"latitude":0.7757307196850269,"longitude":-1.4954120574982648,"height":0},"isLocked":false}},{"locationMeasurement":{"version":1,"location":[71243.07966281034,1210021.6234076065,0],"geoLocation":{"latitude":0.7757382221073379,"longitude":-1.4953775926575128,"height":0},"isLocked":false}},{"stationOffsetMeasurement":{"version":2,"refPoint":[71011.44072720376,1209847.1792709152,15.504021760744482],"pointOnAlignment":[71045.29800106747,1209930.6812270822,15.504021760744482],"distanceAlong":184.99075445611928,"signedOffset":90.10489263733663,"station":3801.5426467599036,"isLocked":false}}]}';
    const json = JSON.parse(civilSnapshotJsonStr);
    assert.isDefined(json.measurements);

    const parsed = Measurement.parse(json.measurements);
    assert.isDefined(parsed);
    assert.isArray(parsed);

    const parsedArray = parsed as Measurement[];
    assert.isTrue(parsedArray.length === 5);

    let distCount = 0, areaCount = 0, locCount = 0;
    for (const m of parsedArray) {
      if (m instanceof DistanceMeasurement) {
        distCount++;
      } else if (m instanceof AreaMeasurement) {
        areaCount++;
      } else if (m instanceof LocationMeasurement) {
        locCount++;
      } else {
        assert.isTrue(false); // Should not happen
      }
    }

    assert.isTrue(distCount === 2);
    assert.isTrue(areaCount === 1);
    assert.isTrue(locCount === 2);
  });
});

// Test subclassing one of the base measurements for serialization. This is a "minimum" example of how to create a new measurement.
export class DistanceMeasurementSubclassSerializer extends DistanceMeasurementSerializer {
  public static readonly distanceMeasurementSubclassName = "distanceMeasurementSubclass";

  public override get measurementName(): string { return DistanceMeasurementSubclassSerializer.distanceMeasurementSubclassName; }

  public override isValidType(measurement: Measurement): boolean {
    return measurement instanceof DistanceMeasurementSubClass;
  }

  public override isValidJSON(json: any): boolean {
    if (!super.isValidJSON(json) || !json.hasOwnProperty("extraProp"))
      return false;

    return true;
  }

  protected override parseSingle(data: MeasurementProps): Measurement | undefined {
    if (!this.isValidJSON(data))
      return undefined;

    return new DistanceMeasurementSubClass(data as DistanceMeasurementProps);
  }
}

export class DistanceMeasurementSubClass extends DistanceMeasurement {
  public static override readonly serializer = Measurement.registerSerializer(new DistanceMeasurementSubclassSerializer());

  public extraProp: number;

  constructor(props?: DistanceMeasurementProps) {
    super();
    this.extraProp = 0;

    if (props)
      this.readFromJSON(props);
  }

  public override equals(other: Measurement, opts?: MeasurementEqualityOptions): boolean {
    if (!super.equals(other, opts))
      return false;

    const otherM = other as DistanceMeasurementSubClass;
    if (otherM === undefined || !Geometry.isSameCoordinate(this.extraProp, otherM.extraProp, (opts) ? opts.tolerance : undefined))
      return false;

    return true;
  }

  protected override copyFrom(other: Measurement) {
    super.copyFrom(other);

    if (other instanceof DistanceMeasurementSubClass) {
      this.extraProp = other.extraProp;
    }
  }

  protected override readFromJSON(json: MeasurementProps) {
    super.readFromJSON(json);

    const jsonAny = json as any;

    if (jsonAny.extraProp !== undefined)
      this.extraProp = jsonAny.extraProp;
  }

  protected override writeToJSON(json: MeasurementProps) {
    super.writeToJSON(json);

    const jsonAny = json as any;
    jsonAny.extraProp = this.extraProp;
  }
}
