/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Point3d, XAndY } from "@itwin/core-geometry";
import type { Cartographic } from "@itwin/core-common";
import { IModelApp, QuantityType } from "@itwin/core-frontend";
import { FormatTraits } from "@itwin/core-quantity";
import { MeasureTools } from "../MeasureTools.js";

import type { FormatProps , FormatterSpec} from "@itwin/core-quantity";
export namespace FormatterUtils {

  /**
   * Gets a FormatterSpec by KoQ string with fallback to QuantityType.
   * @param koqString The Kind of Quantity string to look up.
   * @param fallbackQuantityType The QuantityType to use if KoQ lookup fails.
   * @returns A FormatterSpec or undefined if both lookups fail.
   */
  export function getFormatterSpecWithFallback(koqString: string, fallbackQuantityType: QuantityType): FormatterSpec | undefined {
    // First try to get the spec by KoQ string
    const koqEntry = IModelApp.quantityFormatter.getSpecsByName(koqString);
    if (koqEntry) {
      return koqEntry.formatterSpec;
    }

    // Fallback to QuantityType
    return IModelApp.quantityFormatter.findFormatterSpecByQuantityType(fallbackQuantityType);
  }

  /** Formats a sequence of values with spec without the unit label */
  function formatValuesWithNoUnitLabel(values: number[], spec: FormatterSpec): string {
    const oldFormatTraits = spec.format.formatTraits;

    spec.format.formatTraits &= ~FormatTraits.ShowUnitLabel; // Bit-wise remove ShowUnitLabel trait if exists
    const strs = values.map((value) => IModelApp.quantityFormatter.formatQuantity(value, spec));
    spec.format.formatTraits = oldFormatTraits; // Restore original format traits

    return strs.join(", ");
  }

  export async function formatCoordinates(point: Point3d): Promise<string> {
    const coordSpec =
      await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(
        QuantityType.Coordinate
      );
    return formatCoordinatesImmediate(point, coordSpec);
  }

  export function formatCoordinatesImmediate(point: Point3d, coordSpec?: FormatterSpec): string {
    if (!coordSpec) {
      coordSpec =
        IModelApp.quantityFormatter.findFormatterSpecByQuantityType(
          QuantityType.Coordinate
        );
    }
    if (undefined === coordSpec) return "";

    return formatValuesWithNoUnitLabel([point.x, point.y, point.z], coordSpec);
  }

  export async function formatCoordinatesXY(point: XAndY): Promise<string> {
    const coordSpec =
      await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(
        QuantityType.Coordinate
      );
    return formatCoordinatesXYImmediate(point, coordSpec);
  }

  export function formatCoordinatesXYImmediate(point: XAndY, coordSpec?: FormatterSpec): string {
    if (!coordSpec) {
      coordSpec =
        IModelApp.quantityFormatter.findFormatterSpecByQuantityType(
          QuantityType.Coordinate
        );
    }
    if (undefined === coordSpec) return "";

    return formatValuesWithNoUnitLabel([point.x, point.y], coordSpec);
  }

  /** Formats the input angle into DD°MM'SS.SS" format.
   * NOTE: uses the same symbols as the IModelApp's quantityFormatter for minute and second.
   * The minute symbol is an apostrophe ' while it should be a prime (\u2032)
   * The second symbol is a quotation mark " while it should be a double prime (\u2033)
   */
  export function formatAngleToDMS(angleInDegrees: number): string {
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

  export function formatCartographicToLatLongDMS(c: Cartographic): string {
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

  export async function formatCartographicToLatLong(
    c: Cartographic, angleSpec?: FormatterSpec
  ): Promise<string> {
    if (!angleSpec) {
      angleSpec =
        await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(
          QuantityType.LatLong
        );
    }
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
      angleSpec
    );
    str += MeasureTools.localization.getLocalizedString(latSuffixKey);
    str += ", ";
    str += IModelApp.quantityFormatter.formatQuantity(
      Math.abs(c.longitude),
      angleSpec
    );
    str += MeasureTools.localization.getLocalizedString(longSuffixKey);
    return str;
  }

  export function formatSlope(
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

  export async function formatStation(station: number, stationSpec?: FormatterSpec): Promise<string> {
    if (!stationSpec) {
      stationSpec =
        await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(
          QuantityType.Stationing
        );
    }
    return IModelApp.quantityFormatter.formatQuantity(station, stationSpec);
  }

  export async function formatLength(length: number, lengthSpec?: FormatterSpec): Promise<string> {
    if (!lengthSpec) {
      lengthSpec =
        await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(
          QuantityType.LengthEngineering
        );
    }
    return IModelApp.quantityFormatter.formatQuantity(length, lengthSpec);
  }

  export async function formatAngle(angle: number, angleSpec?: FormatterSpec): Promise<string> {
    if (!angleSpec) {
      angleSpec =
        await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(
          QuantityType.Angle
        );
    }
    return IModelApp.quantityFormatter.formatQuantity(angle, angleSpec);
  }

  export async function formatArea(area: number, areaSpec?: FormatterSpec): Promise<string> {
    if (!areaSpec) {
      areaSpec =
        await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(
          QuantityType.Area
        );
    }
    return IModelApp.quantityFormatter.formatQuantity(area, areaSpec);
  }

  /**
   * @returns The bearing in radians, where 0 is North and π/2 is East.
   */
  export function calculateBearing(dx: number, dy: number): number {
    let bearing = Math.atan2(dx, dy); // radians, 0 = North, π/2 = East
    if (bearing < 0) bearing += 2 * Math.PI; // Normalize to [0, 2π)
    return bearing;
  }

  export function getDefaultBearingFormatProps(): FormatProps {
    return {
      minWidth: 2,
      precision: 0,
      type: "Bearing",
      revolutionUnit: "Units.REVOLUTION",
      formatTraits: ["showUnitLabel"],
      uomSeparator: "",
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          { name: "Units.ARC_DEG", label: "°" },
          { name: "Units.ARC_MINUTE", label: "'" },
          { name: "Units.ARC_SECOND", label: "\"" },
        ],
      },
    };
  }
}
