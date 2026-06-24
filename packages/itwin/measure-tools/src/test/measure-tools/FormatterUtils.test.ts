/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Cartographic } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { Units } from "@itwin/core-quantity";
import { assert } from "chai";
import { FormatterUtils } from "../../api/FormatterUtils.js";

// NOTE: the quantityFormatter (and FormatterUtils) uses the 'apostrophe' and 'quotation mark' rather than the 'prime' and 'double prime'
enum Symbols {
  Deg = "\xB0",
  Min = "\u0027",
  Sec = "\u0022",
  N = "Generic.latitudeNorthSuffix",
  S = "Generic.latitudeSouthSuffix",
  E = "Generic.longitudeEastSuffix",
  W = "Generic.longitudeWestSuffix",
}

describe("FormatterUtils", () => {
  it("test formatCoordinates", async () => {

    await IModelApp.quantityFormatter.setActiveUnitSystem("metric");
    let fCoords = await FormatterUtils.formatCoordinates(Point3d.create(1, 2, 3));
    assert.strictEqual(fCoords, "1, 2, 3");

    fCoords = await FormatterUtils.formatCoordinates(Point3d.create(1.2345678, 5.654321, 9.456789));
    assert.strictEqual(fCoords, "1.23, 5.65, 9.46");

    fCoords = await FormatterUtils.formatCoordinates(Point3d.create(-2.345, -1234.56, -0.001));
    assert.strictEqual(fCoords, "-2.35, -1234.56, -0");

    await IModelApp.quantityFormatter.setActiveUnitSystem("imperial");
    fCoords = await FormatterUtils.formatCoordinates(Point3d.create(1, 2, 3));
    assert.strictEqual(fCoords, "3.28, 6.56, 9.84");
  });

  it("test formatAngleToDMS", () => {
    let fAngle = FormatterUtils.formatAngleToDMS(0.0);
    assert.strictEqual(fAngle, `0${Symbols.Deg}00${Symbols.Min}00.00${Symbols.Sec}`);

    fAngle = FormatterUtils.formatAngleToDMS(45.12345678);
    assert.strictEqual(fAngle, `45${Symbols.Deg}07${Symbols.Min}24.44${Symbols.Sec}`);

    fAngle = FormatterUtils.formatAngleToDMS(-32.567891);
    assert.strictEqual(fAngle, `-32${Symbols.Deg}34${Symbols.Min}04.41${Symbols.Sec}`);
  });

  it("test formatCartographicToLatLongDMS", async () => {
    await IModelApp.quantityFormatter.setActiveUnitSystem("metric");

    let fLatLong = FormatterUtils.formatCartographicToLatLongDMS(Cartographic.fromDegrees({ latitude: 12.345678, longitude: 12.345678 }));
    assert.strictEqual(fLatLong, `12${Symbols.Deg}20${Symbols.Min}44.44${Symbols.Sec}${Symbols.N}, 12${Symbols.Deg}20${Symbols.Min}44.44${Symbols.Sec}${Symbols.E}`);

    fLatLong = FormatterUtils.formatCartographicToLatLongDMS(Cartographic.fromDegrees({ latitude: -82.5467, longitude: -172.43525 }));
    assert.strictEqual(fLatLong, `82${Symbols.Deg}32${Symbols.Min}48.12${Symbols.Sec}${Symbols.S}, 172${Symbols.Deg}26${Symbols.Min}06.90${Symbols.Sec}${Symbols.W}`);

    fLatLong = FormatterUtils.formatCartographicToLatLongDMS(Cartographic.fromDegrees({ latitude: -1.23456, longitude: 0.123456 }));
    assert.strictEqual(fLatLong, `1${Symbols.Deg}14${Symbols.Min}04.42${Symbols.Sec}${Symbols.S}, 0${Symbols.Deg}07${Symbols.Min}24.44${Symbols.Sec}${Symbols.E}`);

    // Changing the activeUnitSystem shouldn't change the output
    await IModelApp.quantityFormatter.setActiveUnitSystem("metric");

    fLatLong = FormatterUtils.formatCartographicToLatLongDMS(Cartographic.fromDegrees({ latitude: 12.345678, longitude: 12.345678 }));
    assert.strictEqual(fLatLong, `12${Symbols.Deg}20${Symbols.Min}44.44${Symbols.Sec}${Symbols.N}, 12${Symbols.Deg}20${Symbols.Min}44.44${Symbols.Sec}${Symbols.E}`);

    fLatLong = FormatterUtils.formatCartographicToLatLongDMS(Cartographic.fromDegrees({ latitude: -82.5467, longitude: -172.43525 }));
    assert.strictEqual(fLatLong, `82${Symbols.Deg}32${Symbols.Min}48.12${Symbols.Sec}${Symbols.S}, 172${Symbols.Deg}26${Symbols.Min}06.90${Symbols.Sec}${Symbols.W}`);

    fLatLong = FormatterUtils.formatCartographicToLatLongDMS(Cartographic.fromDegrees({ latitude: -1.23456, longitude: 0.123456 }));
    assert.strictEqual(fLatLong, `1${Symbols.Deg}14${Symbols.Min}04.42${Symbols.Sec}${Symbols.S}, 0${Symbols.Deg}07${Symbols.Min}24.44${Symbols.Sec}${Symbols.E}`);

  });

  it("test formatCartographicToLatLong", async () => {
    await IModelApp.quantityFormatter.setActiveUnitSystem("metric");

    let fLatLong = await FormatterUtils.formatCartographicToLatLong(Cartographic.fromDegrees({ latitude: 12.345678, longitude: 12.345678 }));
    assert.strictEqual(fLatLong, `12${Symbols.Deg}20${Symbols.Min}44.4408${Symbols.Sec}${Symbols.N}, 12${Symbols.Deg}20${Symbols.Min}44.4408${Symbols.Sec}${Symbols.E}`);

    fLatLong = await FormatterUtils.formatCartographicToLatLong(Cartographic.fromDegrees({ latitude: -82.5467, longitude: -172.43525 }));
    assert.strictEqual(fLatLong, `82${Symbols.Deg}32${Symbols.Min}48.12${Symbols.Sec}${Symbols.S}, 172${Symbols.Deg}26${Symbols.Min}6.9${Symbols.Sec}${Symbols.W}`);

    fLatLong = await FormatterUtils.formatCartographicToLatLong(Cartographic.fromDegrees({ latitude: -1.23456, longitude: 0.123456 }));
    assert.strictEqual(fLatLong, `1${Symbols.Deg}14${Symbols.Min}4.416${Symbols.Sec}${Symbols.S}, 0${Symbols.Deg}7${Symbols.Min}24.4416${Symbols.Sec}${Symbols.E}`);

    // Changing the activeUnitSystem shouldn't change the output
    await IModelApp.quantityFormatter.setActiveUnitSystem("imperial");

    fLatLong = await FormatterUtils.formatCartographicToLatLong(Cartographic.fromDegrees({ latitude: 12.345678, longitude: 12.345678 }));
    assert.strictEqual(fLatLong, `12${Symbols.Deg}20${Symbols.Min}44.4408${Symbols.Sec}${Symbols.N}, 12${Symbols.Deg}20${Symbols.Min}44.4408${Symbols.Sec}${Symbols.E}`);

    fLatLong = await FormatterUtils.formatCartographicToLatLong(Cartographic.fromDegrees({ latitude: -82.5467, longitude: -172.43525 }));
    assert.strictEqual(fLatLong, `82${Symbols.Deg}32${Symbols.Min}48.12${Symbols.Sec}${Symbols.S}, 172${Symbols.Deg}26${Symbols.Min}6.9${Symbols.Sec}${Symbols.W}`);

    fLatLong = await FormatterUtils.formatCartographicToLatLong(Cartographic.fromDegrees({ latitude: -1.23456, longitude: 0.123456 }));
    assert.strictEqual(fLatLong, `1${Symbols.Deg}14${Symbols.Min}4.416${Symbols.Sec}${Symbols.S}, 0${Symbols.Deg}7${Symbols.Min}24.4416${Symbols.Sec}${Symbols.E}`);
  });

  it("getDefaultBearingFormatProps returns ANGLE-phenomenon composite for Units.RAD", () => {
    const props = FormatterUtils.getDefaultBearingFormatProps(Units.ANGLE.RAD);
    assert.strictEqual(props.type, "Bearing");
    assert.strictEqual(props.revolutionUnit, Units.ANGLE.REVOLUTION);
    assert.deepStrictEqual(props.composite?.units.map((u) => u.name), [
      Units.ANGLE.ARC_DEG,
      Units.ANGLE.ARC_MINUTE,
      Units.ANGLE.ARC_SECOND,
    ]);
  });

  it("getDefaultBearingFormatProps returns HORIZONTAL_DIRECTION-phenomenon composite for Units.HORIZONTAL_DIR_RAD", () => {
    const props = FormatterUtils.getDefaultBearingFormatProps(Units.HORIZONTAL_DIRECTION.HORIZONTAL_DIR_RAD);
    assert.strictEqual(props.type, "Bearing");
    assert.strictEqual(props.revolutionUnit, Units.HORIZONTAL_DIRECTION.HORIZONTAL_DIR_REVOLUTION);
    assert.deepStrictEqual(props.composite?.units.map((u) => u.name), [
      Units.HORIZONTAL_DIRECTION.HORIZONTAL_DIR_ARC_DEG,
      Units.HORIZONTAL_DIRECTION.HORIZONTAL_DIR_ARC_MINUTE,
      Units.HORIZONTAL_DIRECTION.HORIZONTAL_DIR_ARC_SECOND,
    ]);
  });

  it("getDefaultBearingFormatProps falls back to ANGLE composite for unknown persistence unit", () => {
    const props = FormatterUtils.getDefaultBearingFormatProps("Units.NOT_A_REAL_UNIT");
    assert.strictEqual(props.revolutionUnit, Units.ANGLE.REVOLUTION);
    assert.strictEqual(props.composite?.units[0].name, Units.ANGLE.ARC_DEG);
  });

  it("getDefaultBearingFormatProps keeps ANGLE composite for a non-RAD ANGLE persistence unit", () => {
    // Edge case: persistence unit is in the ANGLE phenomenon but not RAD; should still pick ANGLE.
    const props = FormatterUtils.getDefaultBearingFormatProps(Units.ANGLE.ARC_DEG);
    assert.strictEqual(props.revolutionUnit, Units.ANGLE.REVOLUTION);
    assert.deepStrictEqual(props.composite?.units.map((u) => u.name), [
      Units.ANGLE.ARC_DEG,
      Units.ANGLE.ARC_MINUTE,
      Units.ANGLE.ARC_SECOND,
    ]);
  });

  it("getDefaultBearingFormatProps applies phenomenon-independent DMS labels", () => {
    const props = FormatterUtils.getDefaultBearingFormatProps(Units.HORIZONTAL_DIRECTION.HORIZONTAL_DIR_RAD);
    assert.deepStrictEqual(props.composite?.units.map((u) => u.label), [Symbols.Deg, Symbols.Min, Symbols.Sec]);
  });

  it("getBearingFormatterSpec round-trips an ANGLE persistence unit without throwing", async () => {
    // No host format is registered for this bogus KoQ, so it exercises the default-fallback path.
    const spec = await FormatterUtils.getBearingFormatterSpec("MeasureTools.NonexistentBearingKoQ", Units.ANGLE.RAD);
    assert.isDefined(spec);
    // PI/2 rad === due east === N90°E in bearing notation.
    const formatted = spec!.applyFormatting(Math.PI / 2);
    assert.isString(formatted);
    assert.isAbove(formatted.length, 0);
  });

  it("getBearingFormatterSpec round-trips a HORIZONTAL_DIRECTION persistence unit without throwing", async () => {
    // Phenomenon mismatch between persistence unit and composite would throw here.
    const spec = await FormatterUtils.getBearingFormatterSpec(
      "MeasureTools.NonexistentBearingKoQ2",
      Units.HORIZONTAL_DIRECTION.HORIZONTAL_DIR_RAD,
    );
    assert.isDefined(spec);
    const formatted = spec!.applyFormatting(Math.PI / 2);
    assert.isString(formatted);
    assert.isAbove(formatted.length, 0);
  });

  it("test formatSlope", () => {
    let fSlope = FormatterUtils.formatSlope(0.01, false);
    assert.strictEqual(fSlope, "0.01%");

    fSlope = FormatterUtils.formatSlope(0.01, true);
    assert.strictEqual(fSlope, "0.01% (1 : 10000.000)");

    fSlope = FormatterUtils.formatSlope(-1.234567, false);
    assert.strictEqual(fSlope, "-1.23%");

    fSlope = FormatterUtils.formatSlope(-1.234567, true);
    assert.strictEqual(fSlope, "-1.23% (-1 : 81.000)");

    fSlope = FormatterUtils.formatSlope(-12345.67891, false);
    assert.strictEqual(fSlope, "-12345.68%");

    fSlope = FormatterUtils.formatSlope(-12345.67891, true);
    assert.strictEqual(fSlope, "-12345.68% (-1 : 0.008)");
  });

});
