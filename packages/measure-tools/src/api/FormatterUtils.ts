/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Point3d, XAndY } from "@bentley/geometry-core";
import { IModelApp, QuantityType } from "@bentley/imodeljs-frontend";
import { Cartographic } from "@bentley/imodeljs-common";
import { FormatterSpec } from "@bentley/imodeljs-quantity";

export class FormatterUtils {

  private static removeUnitSuffixes(s: string) {
    s = s.replace(/ m/g, "");
    s = s.replace(/ ft/g, "");
    return s;
  }

  private static formatCoordinatesWithSpec(point: Point3d, spec: FormatterSpec): string {
    const xStr = FormatterUtils.removeUnitSuffixes(IModelApp.quantityFormatter.formatQuantity(point.x, spec));
    const yStr = FormatterUtils.removeUnitSuffixes(IModelApp.quantityFormatter.formatQuantity(point.y, spec));
    const zStr = FormatterUtils.removeUnitSuffixes(IModelApp.quantityFormatter.formatQuantity(point.z, spec));

    return IModelApp.i18n.translate("MeasureTools:Formatting.xyzPoint", { x: xStr, y: yStr, z: zStr });
  }

  private static formatCoordinatesXYWithSpec(point: XAndY, spec: FormatterSpec): string {
    const xStr = FormatterUtils.removeUnitSuffixes(IModelApp.quantityFormatter.formatQuantity(point.x, spec));
    const yStr = FormatterUtils.removeUnitSuffixes(IModelApp.quantityFormatter.formatQuantity(point.y, spec));

    return IModelApp.i18n.translate("MeasureTools:Formatting.xyPoint", { x: xStr, y: yStr });
  }

  public static async formatCoordinates(point: Point3d): Promise<string> {
    const coordSpec = await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate);
    if (undefined === coordSpec)
      return "";

    return FormatterUtils.formatCoordinatesWithSpec(point, coordSpec);
  }

  public static formatCoordinatesImmediate(point: Point3d): string {
    const coordSpec = IModelApp.quantityFormatter.findFormatterSpecByQuantityType(QuantityType.Coordinate);
    if (undefined === coordSpec)
      return "";

    return FormatterUtils.formatCoordinatesWithSpec(point, coordSpec);
  }

  public static async formatCoordinatesXY(point: XAndY): Promise<string> {
    const coordSpec = await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate);
    if (undefined === coordSpec)
      return "";

    return FormatterUtils.formatCoordinatesXYWithSpec(point, coordSpec);
  }

  public static formatCoordinatesXYImmediate(point: XAndY): string {
    const coordSpec = IModelApp.quantityFormatter.findFormatterSpecByQuantityType(QuantityType.Coordinate);
    if (undefined === coordSpec)
      return "";

    return FormatterUtils.formatCoordinatesXYWithSpec(point, coordSpec);
  }

  /** Formats the input angle into DD°MM′SS.SS″ format */
  public static formatAngleToDMS(angleInDegrees: number): string {
    const d = Math.trunc(angleInDegrees);
    const m = Math.trunc((angleInDegrees - d) * 60);
    const s = ((angleInDegrees - d) * 60 - m) * 60;

    let str = "";
    str += d;
    str += "\xB0";
    str += ("00" + m).slice(-2);
    str += "\u2032";
    str += ("00000" + s.toFixed(2)).slice(-5);
    str += "\u2033";
    return str;
  }

  public static formatCartographicToLatLongDMS(c: Cartographic): string {
    const latSuffixKey = 0 < c.latitude ? "MeasureTools:Generic.latitudeNorthSuffix" : "MeasureTools:Generic.latitudeSouthSuffix";
    const longSuffixKey = 0 < c.longitude ? "MeasureTools:Generic.longitudeEastSuffix" : "MeasureTools:Generic.longitudeWestSuffix";

    let str = FormatterUtils.formatAngleToDMS(Math.abs(c.latitude));
    str += IModelApp.i18n.translate(latSuffixKey);
    str += ", ";
    str += FormatterUtils.formatAngleToDMS(Math.abs(c.longitude));
    str += IModelApp.i18n.translate(longSuffixKey);
    return str;
  }

  public static async formatCartographicToLatLong(c: Cartographic): Promise<string> {
    const latLongSpec = await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(QuantityType.LatLong);
    const latSuffixKey = 0 < c.latitude ? "MeasureTools:Generic.latitudeNorthSuffix" : "MeasureTools:Generic.latitudeSouthSuffix";
    const longSuffixKey = 0 < c.longitude ? "MeasureTools:Generic.longitudeEastSuffix" : "MeasureTools:Generic.longitudeWestSuffix";

    let str = IModelApp.quantityFormatter.formatQuantity(Math.abs(c.latitude), latLongSpec);
    str += IModelApp.i18n.translate(latSuffixKey);
    str += ", ";
    str += IModelApp.quantityFormatter.formatQuantity(Math.abs(c.longitude), latLongSpec);
    str += IModelApp.i18n.translate(longSuffixKey);
    return str;
  }

  public static formatSlope(slopeInPercent: number, withSlopeRatio: boolean): string {
    if (!withSlopeRatio || 0.0 === slopeInPercent)
      return slopeInPercent.toFixed(2) + " %";

    const oneOnSlope = 100.0 / Math.abs(slopeInPercent);
    const sign = slopeInPercent < 0.0 ? "-" : "";
    return slopeInPercent.toFixed(2)  + "%  (" + sign + "1 : " + oneOnSlope.toFixed(3) + ")";
  }

  public static async formatStation(station: number): Promise<string> {
    const spec = await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Stationing);
    return IModelApp.quantityFormatter.formatQuantity(station, spec);
  }

  public static async formatLength(length: number): Promise<string> {
    const spec = await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(QuantityType.LengthEngineering);
    return IModelApp.quantityFormatter.formatQuantity(length, spec);
  }
}
