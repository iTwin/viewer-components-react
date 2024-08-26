/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Point3d, type XYAndZ, type XYZProps } from "@itwin/core-geometry";
import { ColorDef, LinePixels } from "@itwin/core-common";
import type { DecorateContext } from "@itwin/core-frontend";
import { GraphicType, IModelApp, QuantityType } from "@itwin/core-frontend";
import { FormatterUtils } from "../api/FormatterUtils";
import { Measurement, type MeasurementEqualityOptions, MeasurementSerializer, type MeasurementWidgetData } from "../api/Measurement";
import { MeasurementPropertyHelper } from "../api/MeasurementPropertyHelper";
import { MeasureTools } from "../MeasureTools";
import { DistanceMeasurement } from "./DistanceMeasurement";
import type { MeasurementProps } from "../api/MeasurementProps";
import { MeasurementPreferences, MeasurementPreferencesProperty } from "../api/MeasurementPreferences";
import { MeasurementManager } from "../api/MeasurementManager";

export enum PerpendicularMeasurementType {
  Width = "width",
  Height = "height",
}

/**
 * Props for serializing a [[PerpendicularDistanceMeasurement]].
 */
export interface PerpendicularDistanceMeasurementProps extends MeasurementProps {
  startPoint: XYZProps;
  endPoint: XYZProps;
  showAxes?: boolean;
  measurementType: PerpendicularMeasurementType;
}

/** Serializer for a [[PerpendicularDistanceMeasurement]]. */
export class PerpendicularDistanceMeasurementSerializer extends MeasurementSerializer {
  public static readonly perpendicularDistanceMeasurementName = "perpendicularDistanceMeasurement";

  public get measurementName(): string {
    return PerpendicularDistanceMeasurementSerializer.perpendicularDistanceMeasurementName;
  }

  public isValidType(measurement: Measurement): boolean {
    return measurement instanceof PerpendicularDistanceMeasurement;
  }

  public override isValidJSON(json: any): boolean {
    if (!super.isValidJSON(json) || !json.hasOwnProperty("startPoint") || !json.hasOwnProperty("endPoint") || !json.hasOwnProperty("measurementType")) {
      return false;
    }

    return true;
  }

  protected parseSingle(data: MeasurementProps): Measurement | undefined {
    if (!this.isValidJSON(data)) return undefined;

    const props = data as PerpendicularDistanceMeasurementProps;
    return PerpendicularDistanceMeasurement.fromJSON(props);
  }
}

export class PerpendicularDistanceMeasurement extends DistanceMeasurement {
  public static override readonly serializer = Measurement.registerSerializer(new PerpendicularDistanceMeasurementSerializer());

  private _measurementType?: PerpendicularMeasurementType;
  private _secondaryLine?: Point3d[];

  public get measurementType(): PerpendicularMeasurementType {
    return this._measurementType ?? PerpendicularMeasurementType.Height;
  }
  public set measurementType(t: PerpendicularMeasurementType) {
    this._measurementType = t;
  }

  public override setStartPoint(point: XYAndZ) {
    const heightPoints = this.getHeightPoints([Point3d.createFrom(point), this.endPointRef]);
    let newStartPoint = point;
    if (this._measurementType === PerpendicularMeasurementType.Width) {
      newStartPoint = heightPoints[1];
    }
    super.setStartPoint(newStartPoint);
    this.updateSecondaryLine(heightPoints);
  }

  public override setEndPoint(point: XYAndZ, customStartPoint?: Point3d) {
    const heightPoints = this.getHeightPoints([customStartPoint ?? this.startPointRef, Point3d.createFrom(point)]);
    let newEndPoint = point;
    if (this._measurementType === PerpendicularMeasurementType.Height) {
      newEndPoint = heightPoints[1];
    }
    super.setEndPoint(newEndPoint);
    this.updateSecondaryLine(heightPoints);
  }

  private updateSecondaryLine = (heightPoints: Point3d[]) => {
    switch (this._measurementType) {
      case PerpendicularMeasurementType.Width:
        this._secondaryLine = [heightPoints[0], heightPoints[1]];
        break;
      case PerpendicularMeasurementType.Height:
        this._secondaryLine = [heightPoints[1], heightPoints[2]];
        break;
    }
  };

  /**
   * Returns the points for the base and perpendicular lines of a right triangle formed from the hypotenuse.
   */
  private getHeightPoints(hypotenusePoints: Point3d[]): Point3d[] {
    const heightPoints: Point3d[] = [];
    heightPoints.push(hypotenusePoints[0].clone());
    if (hypotenusePoints[0].z > hypotenusePoints[1].z) {
      heightPoints.push(new Point3d(hypotenusePoints[0].x, hypotenusePoints[0].y, hypotenusePoints[1].z));
    } else {
      heightPoints.push(new Point3d(hypotenusePoints[1].x, hypotenusePoints[1].y, hypotenusePoints[0].z));
    }
    heightPoints.push(hypotenusePoints[1].clone());

    return heightPoints;
  }

  public static override create(start: Point3d, end: Point3d, viewType?: string) {
    // Don't ned to serialize the points, will just work as is
    const measurement = new PerpendicularDistanceMeasurement({ startPoint: start, endPoint: end });
    if (viewType) {
      measurement.viewTarget.include(viewType);
    }

    return measurement;
  }

  public override decorate(context: DecorateContext): void {
    super.decorate(context);

    if (this._secondaryLine && this._secondaryLine.length > 0) {
      const secondaryLine = context.createGraphicBuilder(GraphicType.WorldOverlay, undefined, this.getSnapId());
      secondaryLine.setSymbology(ColorDef.white, ColorDef.black, 1, LinePixels.Code5);
      secondaryLine.addLineString(this._secondaryLine);
      context.addDecorationFromBuilder(secondaryLine);
    }
  }

  protected override async getDataForMeasurementWidgetInternal(): Promise<MeasurementWidgetData> {
    const lengthSpec = await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(QuantityType.LengthEngineering);

    const distance = this.worldScale * this.startPointRef.distance(this.endPointRef);
    const run =
      this.drawingMetadata?.worldScale !== undefined
        ? this.worldScale * Math.abs(this.endPointRef.x - this.startPointRef.x)
        : this.startPointRef.distanceXY(this.endPointRef);
    const rise =
      this.drawingMetadata?.worldScale !== undefined
        ? this.worldScale * (this.endPointRef.y - this.startPointRef.y)
        : this.endPointRef.z - this.startPointRef.z;
    const slope = 0.0 < run ? (100 * rise) / run : 0.0;
    const dx = Math.abs(this.endPointRef.x - this.startPointRef.x);
    const dy = Math.abs(this.endPointRef.y - this.startPointRef.y);

    const adjustedStart = this.adjustPointForGlobalOrigin(this.startPointRef);
    const adjustedEnd = this.adjustPointForGlobalOrigin(this.endPointRef);

    const fDistance = IModelApp.quantityFormatter.formatQuantity(distance, lengthSpec);
    const fStartCoords = FormatterUtils.formatCoordinatesImmediate(adjustedStart);
    const fEndCoords = FormatterUtils.formatCoordinatesImmediate(adjustedEnd);
    const fSlope = FormatterUtils.formatSlope(slope, true);
    const fRun = IModelApp.quantityFormatter.formatQuantity(run, lengthSpec);
    const fDeltaX = IModelApp.quantityFormatter.formatQuantity(dx, lengthSpec);
    const fDeltaY = IModelApp.quantityFormatter.formatQuantity(dy, lengthSpec);
    const fRise = IModelApp.quantityFormatter.formatQuantity(rise, lengthSpec);

    const title =
      this._measurementType === PerpendicularMeasurementType.Height
        ? MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureHeight.toolTitle").replace("{0}", fDistance)
        : MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureWidth.toolTitle").replace("{0}", fDistance);
    const data: MeasurementWidgetData = { title, properties: [] };
    MeasurementPropertyHelper.tryAddNameProperty(this, data.properties);

    data.properties.push(
      {
        label:
          this._measurementType === PerpendicularMeasurementType.Height
            ? MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureHeight.height")
            : MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureWidth.width"),
        name: "DistanceMeasurement_Distance",
        value: fDistance,
        aggregatableValue: lengthSpec !== undefined ? { value: distance, formatSpec: lengthSpec } : undefined,
      },
      {
        label: MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureDistance.run"),
        name: "DistanceMeasurement_Run",
        value: fRun,
        aggregatableValue: lengthSpec !== undefined ? { value: run, formatSpec: lengthSpec } : undefined,
      },
      {
        label: MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureDistance.rise"),
        name: "DistanceMeasurement_Rise",
        value: fRise,
      },
      {
        label: MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureDistance.slope"),
        name: "DistanceMeasurement_Slope",
        value: fSlope,
      },
    );

    if (this.drawingMetadata?.worldScale === undefined) {
      data.properties.push(
        {
          label: MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureDistance.delta_x"),
          name: "DistanceMeasurement_Dx",
          value: fDeltaX,
        },
        {
          label: MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureDistance.delta_y"),
          name: "DistanceMeasurement_Dy",
          value: fDeltaY,
        },
        {
          label: MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureDistance.startCoordinates"),
          name: "DistanceMeasurement_StartPoint",
          value: fStartCoords,
        },
        {
          label: MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureDistance.endCoordinates"),
          name: "DistanceMeasurement_EndPoint",
          value: fEndCoords,
        },
      );
    }

    return data;
  }

  /**
   * Tests equality with another measurement.
   * @param other Measurement to test equality for.
   * @param opts Options for equality testing.
   * @returns true if the other measurement is equal, false if some property is not the same or if the measurement is not of the same type.
   */
  public override equals(other: Measurement, opts?: MeasurementEqualityOptions): boolean {
    if (!super.equals(other, opts)) return false;

    // Compare data (ignore isDynamic)
    const tol = opts ? opts.tolerance : undefined;
    const otherDist = other as PerpendicularDistanceMeasurement;
    if (
      otherDist === undefined ||
      !this.startPointRef.isAlmostEqual(otherDist.startPointRef, tol) ||
      !this.endPointRef.isAlmostEqual(otherDist.endPointRef, tol) ||
      this.showAxes !== otherDist.showAxes
    )
      return false;

    return true;
  }

  /**
   * Copies data from the other measurement into this instance.
   * @param other Measurement to copy property values from.
   */
  protected override copyFrom(other: Measurement) {
    super.copyFrom(other);

    if (other instanceof PerpendicularDistanceMeasurement) {
      this.isDynamic = other.isDynamic;
      this.showAxes = other.showAxes;
      this.startPointRef.setFrom(other.startPointRef);
      this.endPointRef.setFrom(other.endPointRef);
      this.buildRunRiseAxes();
      this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
    }
  }

  /**
   * Deserializes properties (if they exist) from the JSON object.
   * @param json JSON object to read data from.
   */
  protected override readFromJSON(json: MeasurementProps) {
    super.readFromJSON(json);

    const jsonDist = json as PerpendicularDistanceMeasurementProps;
    if (jsonDist.startPoint !== undefined) this.startPointRef.setFromJSON(jsonDist.startPoint);

    if (jsonDist.endPoint !== undefined) this.endPointRef.setFromJSON(jsonDist.endPoint);

    if (jsonDist.measurementType !== undefined) this.measurementType = jsonDist.measurementType;

    this.showAxes = jsonDist.showAxes !== undefined ? jsonDist.showAxes : MeasurementPreferences.current.displayMeasurementAxes;

    this.buildRunRiseAxes();
    this.createTextMarker().catch(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  /**
   * Serializes properties to a JSON object.
   * @param json JSON object to append data to.
   */
  protected override writeToJSON(json: MeasurementProps) {
    super.writeToJSON(json);

    const jsonDist = json as PerpendicularDistanceMeasurementProps;
    jsonDist.startPoint = this.startPointRef.toJSON();
    jsonDist.endPoint = this.endPointRef.toJSON();
    jsonDist.showAxes = this.showAxes;
    jsonDist.measurementType = this.measurementType;
  }

  public static override fromJSON(data: PerpendicularDistanceMeasurementProps): PerpendicularDistanceMeasurement {
    return new PerpendicularDistanceMeasurement(data);
  }
}

// Ensure all distance measurements respond to when show axes is turned on/off in preferences
function onDisplayMeasurementAxesHandler(propChanged: MeasurementPreferencesProperty) {
  if (propChanged !== MeasurementPreferencesProperty.displayMeasurementAxes) return;

  const showAxes = MeasurementPreferences.current.displayMeasurementAxes;

  MeasurementManager.instance.forAllMeasurements((measurement: Measurement) => {
    if (measurement instanceof PerpendicularDistanceMeasurement) measurement.showAxes = showAxes;

    return true;
  });
}

MeasurementPreferences.current.onPreferenceChanged.addListener(onDisplayMeasurementAxesHandler);
