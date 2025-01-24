/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Cartographic } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { assert } from "chai";
import { FormatterUtils } from "../../api/FormatterUtils";

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
