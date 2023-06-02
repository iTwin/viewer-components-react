/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Point3d, Transform, Vector3d } from "@itwin/core-geometry";
import { assert } from "chai";
import { TransformHelper } from "../../api/TransformHelper";

describe("Transform helper tests", () => {
  it("Apply transform test", () => {
    const point1 = new Point3d(5, 5, 5);
    const point2 = new Point3d(10, 10, 10);
    const point3 = new Point3d(5, 10, 15);

    assert.isTrue(TransformHelper.applyTransform(undefined, point1)[0].isAlmostEqual(point1));
    assert.isTrue(TransformHelper.applyTransform(undefined, point3)[0].isAlmostEqual(point3));
    assert.isFalse(TransformHelper.applyTransform(undefined, point3)[0].isAlmostEqual(point2));

    const newPointUndefined = TransformHelper.applyTransform(undefined, point1, point2, point3);
    assert.isTrue(newPointUndefined[0].isAlmostEqual(point1));
    assert.isTrue(newPointUndefined[1].isAlmostEqual(point2));
    assert.isTrue(newPointUndefined[2].isAlmostEqual(point3));

    const transformIdentity = Transform.createIdentity();
    assert.isTrue(TransformHelper.applyTransform(transformIdentity, point1)[0].isAlmostEqual(point1));
    assert.isTrue(TransformHelper.applyTransform(transformIdentity, point3)[0].isAlmostEqual(point3));
    assert.isFalse(TransformHelper.applyTransform(transformIdentity, point3)[0].isAlmostEqual(point2));

    const newPointsIdentity = TransformHelper.applyTransform(transformIdentity, point1, point2, point3);
    assert.isTrue(newPointsIdentity[0].isAlmostEqual(point1));
    assert.isTrue(newPointsIdentity[1].isAlmostEqual(point2));
    assert.isTrue(newPointsIdentity[2].isAlmostEqual(point3));

    const transformTriple = Transform.createScaleAboutPoint(Point3d.createZero(), 3);
    assert.isTrue(TransformHelper.applyTransform(transformTriple, point1)[0].isAlmostEqual(new Point3d(15, 15, 15)));
    assert.isTrue(TransformHelper.applyTransform(transformTriple, point3)[0].isAlmostEqual(new Point3d(15, 30, 45)));
    assert.isFalse(TransformHelper.applyTransform(transformTriple, point3)[0].isAlmostEqual(new Point3d(15, 40, 0)));

    const newPointsTriple = TransformHelper.applyTransform(transformTriple, point1, point2, point3);
    assert.isTrue(newPointsTriple[0].isAlmostEqual(new Point3d(15, 15, 15)));
    assert.isTrue(newPointsTriple[1].isAlmostEqual(new Point3d(30, 30, 30)));
    assert.isTrue(newPointsTriple[2].isAlmostEqual(new Point3d(15, 30, 45)));

  })
})