/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Id64String } from "@itwin/core-bentley";
import type { XYZProps } from "@itwin/core-geometry";
import {
  Geometry,
  IModelJson,
  Point3d,
  PointString3d,
} from "@itwin/core-geometry";
import type {
  CartographicProps,
  GeometryStreamProps,
} from "@itwin/core-common";
import { Cartographic } from "@itwin/core-common";
import type { BeButtonEvent, DecorateContext } from "@itwin/core-frontend";
import { GraphicType } from "@itwin/core-frontend";
import { FormatterUtils } from "../api/FormatterUtils";
import {
  StyleSet,
  WellKnownGraphicStyleType,
  WellKnownTextStyleType,
} from "../api/GraphicStyle";
import type {
  MeasurementEqualityOptions,
  MeasurementWidgetData,
} from "../api/Measurement";
import {
  Measurement,
  MeasurementPickContext,
  MeasurementSerializer,
} from "../api/Measurement";
import { WellKnownViewType } from "../api/MeasurementEnums";
import { MeasurementPreferences } from "../api/MeasurementPreferences";
import { MeasurementPropertyHelper } from "../api/MeasurementPropertyHelper";
import type { MeasurementProps } from "../api/MeasurementProps";
import { MeasurementSelectionSet } from "../api/MeasurementSelectionSet";
import { TextMarker } from "../api/TextMarker";
import { MeasureTools } from "../MeasureTools";
import { SheetMeasurementsHelper } from "../api/SheetMeasurementHelper";

/**
 * Props for serializing a [[LocationMeasurement]].
 */
export interface LocationMeasurementProps extends MeasurementProps {
  location: XYZProps;

  geoLocation?: CartographicProps;
  slope?: number;
  station?: number;
  offset?: number;
}

/** Serializer for a [[LocationMeasurement]]. */
export class LocationMeasurementSerializer extends MeasurementSerializer {
  public static readonly locationMeasurementName = "locationMeasurement";

  public get measurementName(): string {
    return LocationMeasurementSerializer.locationMeasurementName;
  }

  public isValidType(measurement: Measurement): boolean {
    return measurement instanceof LocationMeasurement;
  }

  public override isValidJSON(json: any): boolean {
    if (!super.isValidJSON(json) || !json.hasOwnProperty("location"))
      return false;

    return true;
  }

  protected parseSingle(data: MeasurementProps): Measurement | undefined {
    if (!this.isValidJSON(data)) return undefined;

    const props = data as LocationMeasurementProps;
    return LocationMeasurement.fromJSON(props);
  }
}

/**
 * Location measurement. A point somewhere in the world, optionally with other values (such as slope, station, offset, etc).
 */
export class LocationMeasurement extends Measurement {
  public static override readonly serializer = Measurement.registerSerializer(
    new LocationMeasurementSerializer()
  );

  private _location: Point3d;
  private _geoLocation?: Cartographic;
  private _slope?: number;
  private _station?: number;
  private _offset?: number;

  private _textMarker?: TextMarker; // No serialize
  private _isDynamic: boolean; // No serialize

  public get location(): Point3d {
    return this._location;
  }
  public set location(pt: Point3d) {
    this._location.setFrom(pt);
    this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  public get geoLocation(): Cartographic | undefined {
    return this._geoLocation;
  }
  public set geoLocation(geoLoc: Cartographic | undefined) {
    this._geoLocation = geoLoc;
  }

  public get slope(): number | undefined {
    return this._slope;
  }
  public set slope(slope: number | undefined) {
    this._slope = slope;
  }

  public get station(): number | undefined {
    return this._station;
  }
  public set station(station: number | undefined) {
    this._station = station;
  }

  public get offset(): number | undefined {
    return this._offset;
  }
  public set offset(offset: number | undefined) {
    this._offset = offset;
  }

  public get isDynamic(): boolean {
    return this._isDynamic;
  }

  public set isDynamic(v: boolean) {
    this._isDynamic = v;

    if (this._textMarker) this._textMarker.pickable = !v;
  }

  constructor(props?: LocationMeasurementProps) {
    super(props);

    this._location = Point3d.createZero();
    this._isDynamic = false;
    this.getSnapId(); // Preload transient ID"s since we normally don not have these as dynamic

    if (props) {
      this.readFromJSON(props);
    } else {
      this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
    }
  }

  /** Changes the location. Only possible if the measurement is dynamic. */
  public changeLocation(props: LocationMeasurementProps): boolean {
    if (!this.isDynamic)
      return false;

    this.readFromJSON(props);
    return true;
  }

  public override testDecorationHit(
    pickContext: MeasurementPickContext
  ): boolean {
    if (this.transientId && this.transientId === pickContext.geomId)
      return true;

    if (pickContext.buttonEvent && this._textMarker && this.displayLabels)
      return this._textMarker.pick(pickContext.buttonEvent.viewPoint);

    return false;
  }

  public override getDecorationGeometry(
    _pickContext: MeasurementPickContext
  ): GeometryStreamProps | undefined {
    return [
      IModelJson.Writer.toIModelJson(PointString3d.create(this.location)),
    ];
  }

  public override async getDecorationToolTip(
    _pickContext: MeasurementPickContext
  ): Promise<HTMLElement | string> {
    return MeasureTools.localization.getLocalizedString(
      "MeasureTools:Measurements.locationMeasurement"
    );
  }

  private getSnapId(): string | undefined {
    if (!this.transientId)
      this.transientId = MeasurementSelectionSet.nextTransientId;

    if (this.isDynamic)
      return undefined;

    return this.transientId;
  }

  protected override onTransientIdChanged(_prevId: Id64String) {
    if (this._textMarker) this._textMarker.transientHiliteId = this.transientId;
  }

  public override decorate(context: DecorateContext): void {
    super.decorate(context);

    const styleTheme = StyleSet.getOrDefault(this.activeStyle);
    const style = styleTheme.getGraphicStyle(
      WellKnownGraphicStyleType.LocationMeasurement
    )!;

    if (this._textMarker && this.displayLabels)
      this._textMarker.addDecoration(context);

    if (this.isDynamic)
      return;

    const xBuilder = context.createGraphicBuilder(
      GraphicType.WorldDecoration,
      undefined,
      this.getSnapId()
    );
    style.addStyledPointString(xBuilder, [this._location], false);
    context.addDecorationFromBuilder(xBuilder);
  }

  private async createTextMarker(): Promise<void> {
    const adjustedLocation = this.adjustPointForGlobalOrigin(this._location);
    let convertedSheetPoint;
    if (this.drawingMetadata?.sheetToWorldTransform)
      convertedSheetPoint = SheetMeasurementsHelper.measurementTransform(this._location, this.drawingMetadata.sheetToWorldTransform);
    const entries = [
      {
        label: MeasureTools.localization.getLocalizedString(
          "MeasureTools:tools.MeasureLocation.coordinate_x"
        ),
        value: await FormatterUtils.formatLength(convertedSheetPoint?.x ?? adjustedLocation.x),
      },
      {
        label: MeasureTools.localization.getLocalizedString(
          "MeasureTools:tools.MeasureLocation.coordinate_y"
        ),
        value: await FormatterUtils.formatLength(convertedSheetPoint?.y ?? adjustedLocation.y),
      },
      {
        label: MeasureTools.localization.getLocalizedString(
          "MeasureTools:tools.MeasureLocation.coordinate_z"
        ),
        value: await FormatterUtils.formatLength(convertedSheetPoint?.z ?? adjustedLocation.z),
      },
    ];

    if (this._isDynamic) {
      entries.push(
        {
          label: MeasureTools.localization.getLocalizedString(
            "MeasureTools:tools.MeasureLocation.slope"
          ),
          value: this._slope === undefined ? "" : FormatterUtils.formatSlope(100 * this._slope, false),
        }
      );
    }

    if (!this._textMarker) {
      const styleTheme = StyleSet.getOrDefault(this.activeStyle);
      this._textMarker = TextMarker.createHoverBox(
        entries,
        this._location,
        styleTheme
      );
      this._textMarker.pickable = !this.isDynamic;
      this._textMarker.transientHiliteId = this.transientId;
      this._textMarker.setMouseButtonHandler(
        this.handleTextMarkerButtonEvent.bind(this)
      );
    } else {
      this._textMarker.pickable = !this.isDynamic;
      this._textMarker.worldLocation = this._location;
      this._textMarker.textLines = entries;
    }
  }

  protected override async getDataForMeasurementWidgetInternal(): Promise<
  MeasurementWidgetData | undefined
  > {
    let adjustedLocation = this.adjustPointForGlobalOrigin(this._location);
    if (this.drawingMetadata?.sheetToWorldTransform)
      adjustedLocation = SheetMeasurementsHelper.measurementTransform(this._location, this.drawingMetadata.sheetToWorldTransform);
    const fCoordinates = await FormatterUtils.formatCoordinates(adjustedLocation);

    let title = MeasureTools.localization.getLocalizedString(
      "MeasureTools:Measurements.locationMeasurement"
    );
    title += ` [${fCoordinates}]`;

    const data: MeasurementWidgetData = { title, properties: [] };
    MeasurementPropertyHelper.tryAddNameProperty(this, data.properties);

    data.properties.push({
      label: MeasureTools.localization.getLocalizedString(
        "MeasureTools:tools.MeasureLocation.coordinates"
      ),
      name: "LocationMeasurement_Location",
      value: fCoordinates,
    });

    if (this._geoLocation && this.drawingMetadata?.sheetToWorldTransform !== undefined)
      data.properties.push({
        label: MeasureTools.localization.getLocalizedString(
          "MeasureTools:tools.MeasureLocation.latLong"
        ),
        name: "LocationMeasurement_LatLong",
        value: await FormatterUtils.formatCartographicToLatLong(
          this._geoLocation
        ),
      });

    if (MeasurementPreferences.current.displayLocationAltitude) {
      data.properties.push({
        label: MeasureTools.localization.getLocalizedString(
          "MeasureTools:tools.MeasureLocation.altitude"
        ),
        name: "LocationMeasurement_Altitude",
        value: await FormatterUtils.formatLength(adjustedLocation.z),
      });
    }
    if (this.drawingMetadata?.sheetToWorldTransform === undefined) {
      let slopeValue: string;
      if (undefined !== this._slope)
        slopeValue = FormatterUtils.formatSlope(100.0 * this._slope, true);
      else
        slopeValue = MeasureTools.localization.getLocalizedString(
          "MeasureTools:tools.MeasureLocation.slopeUnavailable"
        );

      data.properties.push({
        label: MeasureTools.localization.getLocalizedString(
          "MeasureTools:tools.MeasureLocation.slope"
        ),
        name: "LocationMeasurement_Slope",
        value: slopeValue,
      });
    }

    if (undefined !== this._station) {
      data.properties.push({
        label: MeasureTools.localization.getLocalizedString(
          "MeasureTools:tools.MeasureLocation.station"
        ),
        name: "LocationMeasurement_Station",
        value: await FormatterUtils.formatStation(this._station),
      });
    }

    if (undefined !== this._offset) {
      data.properties.push({
        label: MeasureTools.localization.getLocalizedString(
          "MeasureTools:tools.MeasureLocation.offset"
        ),
        name: "LocationMeasurement_Offset",
        value: await FormatterUtils.formatLength(this._offset),
      });
    }

    return data;
  }

  private handleTextMarkerButtonEvent(ev: BeButtonEvent): boolean {
    if (this._isDynamic) return false;

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.onDecorationButtonEvent(
      MeasurementPickContext.createFromSourceId("Invalid", ev)
    ).catch();

    return true;
  }

  protected override onStyleChanged(_isLock: boolean, _prevStyle: string) {
    this.updateMarkerStyle();
  }

  protected override onLockToggled() {
    this.updateMarkerStyle();
  }

  public override onDisplayUnitsChanged(): void {
    this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  private updateMarkerStyle() {
    if (!this._textMarker) return;

    const styleTheme = StyleSet.getOrDefault(this.activeStyle);
    const tStyle = styleTheme.getTextStyle(WellKnownTextStyleType.HoverBox)!;
    this._textMarker.applyStyle(tStyle);
  }

  /**
   * Tests equality with another measurement.
   * @param other Measurement to test equality for.
   * @param opts Options for equality testing.
   * @returns true if the other measurement is equal, false if some property is not the same or if the measurement is not of the same type.
   */
  public override equals(
    other: Measurement,
    opts?: MeasurementEqualityOptions
  ): boolean {
    if (!super.equals(other, opts)) return false;

    // Compare data (ignore isDynamic)
    const tol =
      opts && opts.tolerance !== undefined
        ? opts.tolerance
        : Geometry.smallMetricDistance;
    const otherLoc = other as LocationMeasurement;
    if (
      otherLoc === undefined ||
      !this._location.isAlmostEqual(otherLoc._location, tol) ||
      !isNearlyEqual(this._offset, otherLoc._offset, tol) ||
      !isNearlyEqual(this._slope, otherLoc._slope, tol) ||
      !isNearlyEqual(this._station, otherLoc._station, tol)
    )
      return false;

    if (
      this._geoLocation !== undefined &&
      otherLoc._geoLocation !== undefined
    ) {
      if (!this._geoLocation.equalsEpsilon(otherLoc._geoLocation, tol))
        return false;
    } else if (this._geoLocation !== otherLoc._geoLocation) {
      return false;
    }

    return true;
  }

  /**
   * Copies data from the other measurement into this instance.
   * @param other Measurement to copy property values from.
   */
  protected override copyFrom(other: Measurement) {
    super.copyFrom(other);

    if (other instanceof LocationMeasurement) {
      this._isDynamic = other._isDynamic;
      this._location.setFrom(other._location);
      this._geoLocation = other._geoLocation
        ? other._geoLocation.clone()
        : undefined;
      this._slope = other._slope;
      this._offset = other._offset;
      this._station = other._station;
      this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
    }
  }

  /**
   * Deserializes properties (if they exist) from the JSON object.
   * @param json JSON object to read data from.
   */
  protected override readFromJSON(json: MeasurementProps) {
    super.readFromJSON(json);

    const jsonLoc = json as LocationMeasurementProps;
    if (jsonLoc.location !== undefined)
      this._location.setFromJSON(jsonLoc.location);

    if (jsonLoc.geoLocation)
      this._geoLocation = Cartographic.fromRadians(jsonLoc.geoLocation);
    else this._geoLocation = undefined;

    this._slope = jsonLoc.slope;
    this._station = jsonLoc.station;
    this._offset = jsonLoc.offset;
    this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  /**
   * Serializes properties to a JSON object.
   * @param json JSON object to append data to.
   */
  protected override writeToJSON(json: MeasurementProps) {
    super.writeToJSON(json);

    const jsonLoc = json as LocationMeasurementProps;
    jsonLoc.location = this._location.toJSON();

    if (this._geoLocation) {
      const geoLoc = this._geoLocation;
      jsonLoc.geoLocation = {
        latitude: geoLoc.latitude,
        longitude: geoLoc.longitude,
        height: geoLoc.height,
      };
    } else {
      jsonLoc.geoLocation = undefined;
    }

    jsonLoc.slope = this._slope;
    jsonLoc.station = this._station;
    jsonLoc.offset = this._offset;
  }

  public static create(location: Point3d, viewType?: string) {
    // Don"t ned to serialize the points, will just work as is
    const measurement = new LocationMeasurement({ location });
    if (viewType) measurement.viewTarget.include(viewType);

    return measurement;
  }

  public static fromJSON(props: LocationMeasurementProps): LocationMeasurement {
    const locMeasurement = new LocationMeasurement(props);

    // LEGACY - Originally location measurements were hardcoded for "MainOnly", so if no viewTarget/viewportType default to "Spatial". So reading this from old JSON
    // we don"t want location measurement"s set to Any...but we want new measurements created to be set to Any if no view types are given!
    if (
      props.viewTarget === undefined &&
      (props as any).viewportType === undefined
    )
      locMeasurement.viewTarget.include(WellKnownViewType.Spatial);

    return locMeasurement;
  }
}

function isNearlyEqual(a?: number, b?: number, tol?: number): boolean {
  if (a !== undefined && b !== undefined) {
    if (!Geometry.isSameCoordinate(a, b, tol)) return false;
  } else if (a !== b) {
    return false;
  }

  return true;
}
