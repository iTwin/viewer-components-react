/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Point3d, type XYAndZ, type XYZProps } from "@itwin/core-geometry";
import { ColorDef, LinePixels } from "@itwin/core-common";
import type { DecorateContext } from "@itwin/core-frontend";
import { GraphicType, IModelApp, QuantityType } from "@itwin/core-frontend";
import { Measurement, type MeasurementEqualityOptions, type MeasurementWidgetData } from "../api/Measurement";
import { MeasureTools } from "../MeasureTools";
import { DistanceMeasurement, type DistanceMeasurementProps, DistanceMeasurementSerializer } from "./DistanceMeasurement";
import type { MeasurementProps } from "../api/MeasurementProps";

export enum PerpendicularMeasurementType {
  Width = "width",
  Height = "height",
}

/**
 * Props for serializing a [[PerpendicularDistanceMeasurement]].
 */
export interface PerpendicularDistanceMeasurementProps extends DistanceMeasurementProps {
  measurementType: PerpendicularMeasurementType;
  secondaryLine?: XYZProps[];
}

/** Serializer for a [[PerpendicularDistanceMeasurement]]. */
export class PerpendicularDistanceMeasurementSerializer extends DistanceMeasurementSerializer {
  public static readonly perpendicularDistanceMeasurementName = "perpendicularDistanceMeasurement";

  public override get measurementName(): string {
    return PerpendicularDistanceMeasurementSerializer.perpendicularDistanceMeasurementName;
  }

  public override isValidType(measurement: Measurement): boolean {
    return measurement instanceof PerpendicularDistanceMeasurement;
  }

  public override isValidJSON(json: any): boolean {
    if (!super.isValidJSON(json) || !json.hasOwnProperty("startPoint") || !json.hasOwnProperty("endPoint") || !json.hasOwnProperty("measurementType")) {
      return false;
    }

    return true;
  }

  protected override parseSingle(data: MeasurementProps): Measurement | undefined {
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
    const distanceData = await super.getDataForMeasurementWidgetInternal();

    const lengthSpec = await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(QuantityType.LengthEngineering);
    const distance = this.worldScale * this.startPointRef.distance(this.endPointRef);
    const fDistance = IModelApp.quantityFormatter.formatQuantity(distance, lengthSpec);

    const title =
      this._measurementType === PerpendicularMeasurementType.Height
      ? MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureHeight.toolTitle").replace("{{value}}", fDistance)
      : MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureWidth.toolTitle").replace("{{value}}", fDistance);

    const label =
      this._measurementType === PerpendicularMeasurementType.Height
        ? MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureHeight.height")
        : MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureWidth.width");

    distanceData.title = title;
    const distanceProperty = distanceData.properties.find((p) => p.name === "DistanceMeasurement_Distance");
    if (distanceProperty) {
      distanceProperty.label = label;
    }
    return distanceData;
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
    if (this._measurementType !== otherDist.measurementType) {
      return false;
    }
    if (this._secondaryLine && otherDist._secondaryLine) {
      if (this._secondaryLine.length !== otherDist._secondaryLine.length) {
        return false;
      }
      for (let i = 0; i < this._secondaryLine.length; i++) {
        if (!this._secondaryLine[i].isAlmostEqual(otherDist._secondaryLine[i], tol)) {
          return false;
        }
      }
    }
    if ((this._secondaryLine && !otherDist._secondaryLine) || (!this._secondaryLine && otherDist._secondaryLine)) {
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

    if (other instanceof PerpendicularDistanceMeasurement) {
      this.measurementType = other.measurementType;
      this._secondaryLine = other._secondaryLine ? other._secondaryLine.map((p) => p.clone()) : undefined;
    }
  }

  /**
   * Deserializes properties (if they exist) from the JSON object.
   * @param json JSON object to read data from.
   */
  protected override readFromJSON(json: MeasurementProps) {
    super.readFromJSON(json);

    const jsonDist = json as PerpendicularDistanceMeasurementProps;
    if (jsonDist.measurementType !== undefined) {
      this.measurementType = jsonDist.measurementType;
    }
    if (jsonDist.secondaryLine !== undefined) {
      this._secondaryLine = jsonDist.secondaryLine.map((p) => Point3d.fromJSON(p));
    }
  }

  /**
   * Serializes properties to a JSON object.
   * @param json JSON object to append data to.
   */
  protected override writeToJSON(json: MeasurementProps) {
    super.writeToJSON(json);

    const jsonDist = json as PerpendicularDistanceMeasurementProps;
    jsonDist.measurementType = this.measurementType;
    jsonDist.secondaryLine = this._secondaryLine as XYZProps[];
  }

  public static override fromJSON(data: PerpendicularDistanceMeasurementProps): PerpendicularDistanceMeasurement {
    return new PerpendicularDistanceMeasurement(data);
  }
}
