/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { IModelConnection } from "@itwin/core-frontend";
import { Point2d, Point3d, Transform } from "@itwin/core-geometry";
import { assert } from "chai";
import { afterEach, describe, it, vi } from "vitest";
import { DrawingDataCache } from "../../api/DrawingTypeDataCache.js";
import { DrawingMetadata } from "../../api/Measurement.js";
import { SheetMeasurementHelper } from "../../api/SheetMeasurementHelper.js";
import { WellKnownViewType } from "../../api/MeasurementEnums.js";
import { DistanceMeasurement } from "../../measurements/DistanceMeasurement.js";

// Taken from a plan-and-profile sheet where the plan view attachment fully encloses the profile view attachment.
const planDrawing: SheetMeasurementHelper.DrawingTypeData = {
  id: "0x20000000161",
  type: SheetMeasurementHelper.DrawingTypeEnum.Plan,
  origin: { x: -0.010901885858856986, y: 0.0733496210801317 },
  bBoxLow: { x: 0, y: 0 },
  bBoxHigh: { x: 0.8713426995780083, y: 0.683576266158866 },
};

const profileDrawing: SheetMeasurementHelper.DrawingTypeData = {
  id: "0x20000000162",
  type: SheetMeasurementHelper.DrawingTypeEnum.ProfileOrElevation,
  origin: { x: 0.05097792785857891, y: 0.0755846793892972 },
  bBoxLow: { x: 0, y: 0 },
  bBoxHigh: { x: 0.7625306571302384, y: 0.2189899393616121 },
};

// Horizontal scale 1:600, vertical scale 1:120 (a 5x vertical exaggeration).
const profileTransformProps = [[600, 0, 0, 0], [0, 120, 0, 0], [0, 0, 1, 0]];

const pointInsideBothDrawings = Point3d.create(0.7278001436368169, 0.22686231342959792);
const sheetViewId = "0x1";
const imodel = { isBlank: false } as unknown as IModelConnection;
const profileToolDrawingTypes = [
  SheetMeasurementHelper.DrawingTypeEnum.Section,
  SheetMeasurementHelper.DrawingTypeEnum.ProfileOrElevation,
];

function stubDrawingCache(drawings: SheetMeasurementHelper.DrawingTypeData[], profileDrawingHasTransform = true) {
  vi.spyOn(DrawingDataCache, "getInstance").mockReturnValue({
    querySheetDrawingData: async () => drawings,
    querySpatialInfo: async (_imodel: IModelConnection, drawing: SheetMeasurementHelper.DrawingTypeData) => {
      const isProfileWithTransform = drawing.id === profileDrawing.id && profileDrawingHasTransform;
      return {
        sheetScale: 600,
        sheetToProfileTransformProps: isProfileWithTransform ? profileTransformProps : undefined,
      };
    },
  } as unknown as DrawingDataCache);
}

describe("SheetMeasurementHelper.getDrawingMetadata", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips an overlapping drawing whose type is not allowed", async () => {
    // The plan attachment encloses the profile and defines no sheetToProfileTransform, so selecting it left profile
    // measurements in sheet units.
    stubDrawingCache([planDrawing, profileDrawing]);

    const metadata = await SheetMeasurementHelper.getDrawingMetadata(imodel, sheetViewId, pointInsideBothDrawings, profileToolDrawingTypes);

    assert.strictEqual(metadata?.drawingId, profileDrawing.id);
    assert.strictEqual(metadata?.drawingType, SheetMeasurementHelper.DrawingTypeEnum.ProfileOrElevation);
  });

  it("returns the first containing drawing when no types are given", async () => {
    stubDrawingCache([planDrawing, profileDrawing]);

    const metadata = await SheetMeasurementHelper.getDrawingMetadata(imodel, sheetViewId, pointInsideBothDrawings);

    assert.strictEqual(metadata?.drawingId, planDrawing.id);
  });

  it("returns undefined when no drawing of an allowed type contains the point", async () => {
    stubDrawingCache([planDrawing]);

    const metadata = await SheetMeasurementHelper.getDrawingMetadata(imodel, sheetViewId, pointInsideBothDrawings, profileToolDrawingTypes);

    assert.isUndefined(metadata);
  });

  it("carries the profile transform of the resolved drawing", async () => {
    stubDrawingCache([planDrawing, profileDrawing]);

    const metadata = await SheetMeasurementHelper.getDrawingMetadata(imodel, sheetViewId, pointInsideBothDrawings, profileToolDrawingTypes);

    // One inch of sheet at the 1:120 vertical scale is 3.048 m (10 ft), not the raw 0.0254 m of sheet space.
    const transform = metadata?.sheetToProfileTransform;
    assert.isDefined(transform);
    const start = transform!.multiplyPoint3d(Point3d.create(0, 0));
    const end = transform!.multiplyPoint3d(Point3d.create(0, 0.0254));
    assert.closeTo(start.distance(end), 3.048, 1e-6);
  });

  it("leaves the profile transform undefined when the drawing does not define one", async () => {
    // Transform.fromJSON yields identity for missing props, which would silently report sheet units as world units.
    stubDrawingCache([planDrawing, profileDrawing], false);

    const metadata = await SheetMeasurementHelper.getDrawingMetadata(imodel, sheetViewId, pointInsideBothDrawings, profileToolDrawingTypes);

    assert.strictEqual(metadata?.drawingId, profileDrawing.id);
    assert.isUndefined(metadata?.sheetToProfileTransform);
  });
});

describe("DrawingMetadata profile transform round-trip", () => {
  const metadata: DrawingMetadata = {
    origin: Point2d.create(0.05097792785857891, 0.0755846793892972),
    extents: Point2d.create(0.7625306571302384, 0.2189899393616121),
    drawingId: profileDrawing.id,
    drawingType: SheetMeasurementHelper.DrawingTypeEnum.ProfileOrElevation,
    sheetToProfileTransform: Transform.fromJSON(profileTransformProps),
  };

  it("survives toJSON and fromJSON", () => {
    const restored = DrawingMetadata.fromJSON(DrawingMetadata.toJSON(metadata)!);

    assert.strictEqual(restored.drawingType, SheetMeasurementHelper.DrawingTypeEnum.ProfileOrElevation);
    assert.isTrue(restored.sheetToProfileTransform!.isAlmostEqual(metadata.sheetToProfileTransform!));
  });

  it("survives measurement clone", () => {
    const measurement = DistanceMeasurement.create(Point3d.create(0, 0, 0), Point3d.create(1, 1, 1), WellKnownViewType.Sheet);
    measurement.drawingMetadata = metadata;

    const cloned = measurement.clone();

    assert.strictEqual(cloned.drawingMetadata?.drawingType, SheetMeasurementHelper.DrawingTypeEnum.ProfileOrElevation);
    assert.isTrue(cloned.drawingMetadata!.sheetToProfileTransform!.isAlmostEqual(metadata.sheetToProfileTransform!));
  });
});
