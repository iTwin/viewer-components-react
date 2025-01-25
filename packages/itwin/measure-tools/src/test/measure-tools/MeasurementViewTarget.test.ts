/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { WellKnownViewType } from "../../api/MeasurementEnums.js";
import { MeasurementViewTarget } from "../../api/MeasurementViewTarget.js";

describe("MeasurementViewTarget tests", () => {
  it("Test add/remove", () => {
    const test = new MeasurementViewTarget();
    test.include(WellKnownViewType.XSection);
    assert.isTrue(test.primary === WellKnownViewType.XSection);
    test.include([WellKnownViewType.AnyDrawing, WellKnownViewType.AnySpatial]);
    assert.isTrue(test.included.size === 3);

    // Should remove from include
    test.exclude(WellKnownViewType.XSection);
    assert.isFalse(test.included.has(WellKnownViewType.XSection));
    assert.isTrue(test.included.size === 2);

    // Should skip any
    test.include(WellKnownViewType.Any);
    assert.isFalse(test.included.has(WellKnownViewType.Any));

    // Should skip any* types
    test.exclude(WellKnownViewType.AnySpatial);
    assert.isFalse(test.excluded.has(WellKnownViewType.AnySpatial));

    test.exclude(WellKnownViewType.AnyDrawing);
    assert.isFalse(test.excluded.has(WellKnownViewType.AnyDrawing));

    test.exclude(WellKnownViewType.Any);
    assert.isFalse(test.excluded.has(WellKnownViewType.Any));

    test.clear();
    assert.isTrue(test.included.size === 0);
    assert.isTrue(test.primary === WellKnownViewType.Any);

    test.add(WellKnownViewType.Sheet);
    test.remove(WellKnownViewType.Sheet);
    assert.isTrue(test.included.size === 0);
  });

  it("Test replace", () => {
    const test = new MeasurementViewTarget();
    test.include(WellKnownViewType.XSection);
    test.include(WellKnownViewType.Spatial);
    assert.isTrue(test.included.size === 2);
    assert.isTrue(test.primary === WellKnownViewType.XSection);

    test.replace(WellKnownViewType.Profile, true);
    assert.isTrue(test.included.size === 1);
    assert.isTrue(test.primary === WellKnownViewType.Profile);

    test.exclude(WellKnownViewType.XSection);
    test.exclude(WellKnownViewType.Spatial);
    assert.isTrue(test.excluded.size === 2);

    test.replace(WellKnownViewType.Sheet, false);
    assert.isTrue(test.excluded.size === 1);
    assert.isTrue(test.excluded.has(WellKnownViewType.Sheet));
  });

  it("Test clone/equals/copyfrom/merge", () => {
    const test = new MeasurementViewTarget();
    test.include([WellKnownViewType.Spatial, WellKnownViewType.XSection]);
    test.exclude(WellKnownViewType.Profile);

    const testJson = test.toJSON();
    const testFromJson = MeasurementViewTarget.fromJSON(testJson);
    assert.isTrue(test.equals(testFromJson));

    const test2 = new MeasurementViewTarget();
    test.exclude(WellKnownViewType.Profile);

    assert.isFalse(test.equals(test2));

    test2.copyFrom(test);
    assert.isTrue(test.equals(test2));

    const test3 = test.clone();
    assert.isTrue(test.equals(test3));

    test.clear();
    test.merge(test3);
    assert.isTrue(test.equals(test3));
  });

  it("Test isOfViewType", () => {
    const test = new MeasurementViewTarget();
    test.add(WellKnownViewType.AnySpatial);
    test.add(WellKnownViewType.AnyDrawing);
    test.add(WellKnownViewType.Profile, false);
    test.add(WellKnownViewType.XSection, false);

    // Because of all the Any*'s this viewport will be compatible with anything we throw at it except the ones it specifically excludes
    assert.isTrue(test.isOfViewType(WellKnownViewType.Any));
    assert.isTrue(test.isOfViewType(WellKnownViewType.AnySpatial));
    assert.isTrue(test.isOfViewType(WellKnownViewType.AnyDrawing));
    assert.isTrue(test.isOfViewType(WellKnownViewType.Spatial));
    assert.isTrue(test.isOfViewType(WellKnownViewType.Sheet));

    assert.isFalse(test.isOfViewType(WellKnownViewType.Profile));
    assert.isFalse(test.isOfViewType(WellKnownViewType.XSection));

    // If we remove AnyDrawing, then we no longer will be compatible with Sheet views since we don't explicitly include that
    test.remove(WellKnownViewType.AnyDrawing);

    assert.isFalse(test.isOfViewType(WellKnownViewType.AnyDrawing));
    assert.isFalse(test.isOfViewType(WellKnownViewType.Sheet));

    // If we explicitly inclue sheet, we now are true for sheet views, and we also pass AnyDrawing again since sheet is in that hierarchy.
    test.add(WellKnownViewType.Sheet);

    assert.isTrue(test.isOfViewType(WellKnownViewType.AnyDrawing));
    assert.isTrue(test.isOfViewType(WellKnownViewType.Sheet));
  });
});
