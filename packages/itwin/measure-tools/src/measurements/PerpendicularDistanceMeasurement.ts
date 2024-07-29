/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Point3d } from "@itwin/core-geometry";
import { ColorDef, LinePixels } from "@itwin/core-common";
import type { DecorateContext } from "@itwin/core-frontend";
import { GraphicType, IModelApp, QuantityType } from "@itwin/core-frontend";
import { FormatterUtils } from "../api/FormatterUtils";
import type { MeasurementWidgetData } from "../api/Measurement";
import { MeasurementPropertyHelper } from "../api/MeasurementPropertyHelper";
import { MeasureTools } from "../MeasureTools";
import { DistanceMeasurement } from "./DistanceMeasurement";

export class PerpendicularDistanceMeasurement extends DistanceMeasurement {
  private _toolName?: string;
  private _secondaryLine?: Point3d[];

  public get secondaryLine(): Point3d[] {
    return this._secondaryLine ?? [];
  }
  public set secondaryLine(l: Point3d[]) {
    this._secondaryLine = l;
  }
  public get toolName(): string {
    return this._toolName ?? "";
  }
  public set toolName(t: string) {
    this._toolName = t;
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
    const toolName = this._toolName ?? "";
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

    let title = `${toolName} ${MeasureTools.localization.getLocalizedString("MeasureTools:Measurements.measurement")}`;
    title += ` [${fDistance}]`;

    const data: MeasurementWidgetData = { title, properties: [] };
    MeasurementPropertyHelper.tryAddNameProperty(this, data.properties);

    data.properties.push(
      {
        label: `${toolName}:`,
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
}
