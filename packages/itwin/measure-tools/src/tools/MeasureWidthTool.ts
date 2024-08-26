/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { MeasureTools } from "../MeasureTools";
import { MeasureDistanceToolModel } from "../toolmodels/MeasureDistanceToolModel";
import type { Point3d } from "@itwin/core-geometry";
import { type BeButtonEvent, type DecorateContext, EventHandled } from "@itwin/core-frontend";
import { MeasurementViewTarget } from "../api/MeasurementViewTarget";
import { MeasurePerpendicularDistanceTool } from "./MeasurePerpendicularDistanceTool";
import { PerpendicularMeasurementType } from "../measurements/PerpendicularDistanceMeasurement";

export class MeasureWidthTool extends MeasurePerpendicularDistanceTool {
  public static override toolId = "MeasureTools.MeasureWidth";
  private _mouseStartPoint: Point3d | undefined;

  public static override get flyover() {
    return MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureWidth.flyover");
  }
  public static override get description(): string {
    return MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureWidth.description");
  }
  public static override get keyin(): string {
    return MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureWidth.keyin");
  }

  public override async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    super.onDataButtonDown(ev, this._mouseStartPoint);
    this._mouseStartPoint = ev.point.clone();
    return EventHandled.Yes;
  }

  public override async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    super.onMouseMotion(ev);
    if (
      !ev.viewport ||
      this.toolModel.currentState !== MeasureDistanceToolModel.State.SetEndPoint ||
      !this.toolModel.dynamicMeasurement ||
      !this._mouseStartPoint
    )
      return;

    const viewType = MeasurementViewTarget.classifyViewport(ev.viewport);
    this.toolModel.setStartPoint(viewType, this._mouseStartPoint);
    this.toolModel.setEndPoint(viewType, ev.point, true, this._mouseStartPoint);
  }

  public override decorate(context: DecorateContext): void {
    super.decorate(context);

    if (!this.isCompatibleViewport(context.viewport, false) || !this.toolModel.dynamicMeasurement) return;

    this.toolModel.dynamicMeasurement.measurementType = PerpendicularMeasurementType.Width;

    if (this.toolModel.currentState === MeasureDistanceToolModel.State.SetEndPoint && this._mouseStartPoint) {
      const hypotenusePoints: Point3d[] = [this._mouseStartPoint, this.toolModel.dynamicMeasurement.endPointRef];
      this.createHypotenuseDecoration(context, hypotenusePoints);
    }
  }
}
