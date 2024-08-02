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

export class MeasureHeightTool extends MeasurePerpendicularDistanceTool {
  public static override toolId = "MeasureTools.MeasureHeight";
  private _mouseEndPoint: Point3d | undefined;

  public static override get flyover() {
    return MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureHeight.flyover");
  }
  public static override get description(): string {
    return MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureHeight.description");
  }
  public static override get keyin(): string {
    return MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureHeight.keyin");
  }

  public override async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (!ev.viewport) return EventHandled.No;

    if (this.toolModel.currentState === MeasureDistanceToolModel.State.SetMeasurementViewport) {
      super.onDataButtonDown(ev);
      return EventHandled.Yes;
    } else if (this.toolModel.currentState === MeasureDistanceToolModel.State.SetEndPoint && this.toolModel.dynamicMeasurement) {
      const viewType = MeasurementViewTarget.classifyViewport(ev.viewport);
      const heightPoints = this.getHeightPoints([this.toolModel.dynamicMeasurement.startPointRef, ev.point]);
      this.toolModel.setEndPoint(viewType, heightPoints[1], false); // Change the measure end point
      await this.onReinitialize();
    }

    ev.viewport.invalidateDecorations();
    return EventHandled.Yes;
  }

  public override async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    if (!ev.viewport || this.toolModel.currentState !== MeasureDistanceToolModel.State.SetEndPoint || !this.toolModel.dynamicMeasurement) return;
    const type = MeasurementViewTarget.classifyViewport(ev.viewport);
    const heightPoints = this.getHeightPoints([this.toolModel.dynamicMeasurement.startPointRef, ev.point]);
    this.toolModel.setEndPoint(type, heightPoints[1], true); // Change the measure end point
    this._mouseEndPoint = ev.point.clone(); // Save the current point for decoration
    ev.viewport.invalidateDecorations();
  }

  public override decorate(context: DecorateContext): void {
    super.decorate(context);

    if (!this.isCompatibleViewport(context.viewport, false) || !this.toolModel.dynamicMeasurement) return;

    this.toolModel.dynamicMeasurement.measurementType = PerpendicularMeasurementType.Height;

    if (this.toolModel.currentState === MeasureDistanceToolModel.State.SetEndPoint && this.toolModel.dynamicMeasurement && this._mouseEndPoint) {
      const hypotenusePoints: Point3d[] = [this.toolModel.dynamicMeasurement.startPointRef, this._mouseEndPoint];
      this.createHypotenuseDecoration(context, hypotenusePoints);
      const heightPoints = this.getHeightPoints(hypotenusePoints);

      this.toolModel.dynamicMeasurement.secondaryLine = [heightPoints[1], heightPoints[2]];
    }
  }
}
