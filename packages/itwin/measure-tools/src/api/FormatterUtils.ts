/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Point3d, XAndY } from "@itwin/core-geometry";
import type { Cartographic } from "@itwin/core-common";
import { IModelApp, QuantityType } from "@itwin/core-frontend";
import { FormatTraits, type FormatterSpec } from "@itwin/core-quantity";
import { MeasureTools } from "../MeasureTools.js";

export class FormatterUtils {
  private static removeUnitSuffixes(s: string) {
    s = s.replace(/ m/g, "");
    s = s.replace(/ ft/g, "");
    return s;
  }

  private static formatCoordinatesWithSpec(
    point: Point3d,
    spec: FormatterSpec
  ): string {
    const xStr = FormatterUtils.removeUnitSuffixes(
      IModelApp.quantityFormatter.formatQuantity(point.x, spec)
    );
    const yStr = FormatterUtils.removeUnitSuffixes(
      IModelApp.quantityFormatter.formatQuantity(point.y, spec)
    );
    const zStr = FormatterUtils.removeUnitSuffixes(
      IModelApp.quantityFormatter.formatQuantity(point.z, spec)
    );
    return `${xStr}, ${yStr}, ${zStr}`;
  }

  private static formatCoordinatesXYWithSpec(
    point: XAndY,
    spec: FormatterSpec
  ): string {
    const xStr = FormatterUtils.removeUnitSuffixes(
      IModelApp.quantityFormatter.formatQuantity(point.x, spec)
    );
    const yStr = FormatterUtils.removeUnitSuffixes(
      IModelApp.quantityFormatter.formatQuantity(point.y, spec)
    );
    return `${xStr}, ${yStr}`;
  }

  public static async formatCoordinates(point: Point3d): Promise<string> {
    const coordSpec =
      await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(
        QuantityType.Coordinate
      );
    if (undefined === coordSpec) return "";

    return FormatterUtils.formatCoordinatesWithSpec(point, coordSpec);
  }

  public static formatCoordinatesImmediate(point: Point3d, coordSpec?: FormatterSpec): string {
    let result: string;
    if (!coordSpec) {
      coordSpec =
        IModelApp.quantityFormatter.findFormatterSpecByQuantityType(
          QuantityType.Coordinate
        );
      if (undefined === coordSpec) return "";
      result = FormatterUtils.formatCoordinatesWithSpec(point, coordSpec);
    } else {
      // eslint-disable-next-line @itwin/no-internal
      const oldFormatTraits = coordSpec.format.formatTraits;
      // eslint-disable-next-line @itwin/no-internal
      coordSpec.format.formatTraits &= ~FormatTraits.ShowUnitLabel;
      result = FormatterUtils.formatCoordinatesWithSpec(point, coordSpec);
      // eslint-disable-next-line @itwin/no-internal
      coordSpec.format.formatTraits = oldFormatTraits; // Restore original format traits
    }

    return result;
  }

  public static async formatCoordinatesXY(point: XAndY): Promise<string> {
    const coordSpec =
      await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(
        QuantityType.Coordinate
      );
    if (undefined === coordSpec) return "";

    return FormatterUtils.formatCoordinatesXYWithSpec(point, coordSpec);
  }

  public static formatCoordinatesXYImmediate(point: XAndY): string {
    const coordSpec =
      IModelApp.quantityFormatter.findFormatterSpecByQuantityType(
        QuantityType.Coordinate
      );
    if (undefined === coordSpec) return "";

    return FormatterUtils.formatCoordinatesXYWithSpec(point, coordSpec);
  }

  /** Formats the input angle into DD°MM'SS.SS" format.
   * NOTE: uses the same symbols as the IModelApp's quantityFormatter for minute and second.
   * The minute symbol is an apostrophe ' while it should be a prime (\u2032)
   * The second symbol is a quotation mark " while it should be a double prime (\u2033)
   */
  public static formatAngleToDMS(angleInDegrees: number): string {
    const isNegative = angleInDegrees < 0;
    angleInDegrees = Math.abs(angleInDegrees);

    const d = Math.trunc(angleInDegrees);
    const m = Math.abs(Math.trunc((angleInDegrees - d) * 60));
    const s = Math.abs(((angleInDegrees - d) * 60 - m) * 60);

    let str = isNegative ? "-" : "";
    str += d;
    str += "\xB0";
    str += `00${m}`.slice(-2);
    str += "\u0027";
    str += `00000${s.toFixed(2)}`.slice(-5);
    str += "\u0022";
    return str;
  }

  public static formatCartographicToLatLongDMS(c: Cartographic): string {
    const latSuffixKey =
      0 < c.latitude
        ? "MeasureTools:Generic.latitudeNorthSuffix"
        : "MeasureTools:Generic.latitudeSouthSuffix";
    const longSuffixKey =
      0 < c.longitude
        ? "MeasureTools:Generic.longitudeEastSuffix"
        : "MeasureTools:Generic.longitudeWestSuffix";

    let str = FormatterUtils.formatAngleToDMS(Math.abs(c.latitudeDegrees));
    str += MeasureTools.localization.getLocalizedString(latSuffixKey);
    str += ", ";
    str += FormatterUtils.formatAngleToDMS(Math.abs(c.longitudeDegrees));
    str += MeasureTools.localization.getLocalizedString(longSuffixKey);
    return str;
  }

  public static async formatCartographicToLatLong(
    c: Cartographic
  ): Promise<string> {
    const latLongSpec =
      await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(
        QuantityType.LatLong
      );
    const latSuffixKey =
      0 < c.latitude
        ? "MeasureTools:Generic.latitudeNorthSuffix"
        : "MeasureTools:Generic.latitudeSouthSuffix";
    const longSuffixKey =
      0 < c.longitude
        ? "MeasureTools:Generic.longitudeEastSuffix"
        : "MeasureTools:Generic.longitudeWestSuffix";

    let str = IModelApp.quantityFormatter.formatQuantity(
      Math.abs(c.latitude),
      latLongSpec
    );
    str += MeasureTools.localization.getLocalizedString(latSuffixKey);
    str += ", ";
    str += IModelApp.quantityFormatter.formatQuantity(
      Math.abs(c.longitude),
      latLongSpec
    );
    str += MeasureTools.localization.getLocalizedString(longSuffixKey);
    return str;
  }

  public static formatSlope(
    slopeInPercent: number,
    withSlopeRatio: boolean
  ): string {

    const fSlope = `${slopeInPercent.toFixed(2)}%`;

    if (!withSlopeRatio || 0.0 === slopeInPercent)
      return fSlope;

    const oneOverSlope = 100.0 / Math.abs(slopeInPercent);
    const sign = slopeInPercent < 0.0 ? "-" : "";
    const fSlopeRatio = `${sign}1 : ${oneOverSlope.toFixed(3)}`;

    return `${fSlope} (${fSlopeRatio})`;
  }

  public static async formatStation(station: number): Promise<string> {
    const spec =
      await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(
        QuantityType.Stationing
      );
    return IModelApp.quantityFormatter.formatQuantity(station, spec);
  }

  public static async formatLength(length: number): Promise<string> {
    const spec =
      await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(
        QuantityType.LengthEngineering
      );
    return IModelApp.quantityFormatter.formatQuantity(length, spec);
  }
}
