/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { MeasureTools } from "../MeasureTools";
import { MeasureDistanceToolModel } from "../toolmodels/MeasureDistanceToolModel";
import { Point3d } from "@itwin/core-geometry";
import { BeButtonEvent, DecorateContext, EventHandled } from "@itwin/core-frontend";
import { MeasurementViewTarget } from "../api/MeasurementViewTarget";
import { MeasurePerpendicularDistanceTool } from "./MeasurePerpendicularDistanceTool";

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
    super.onDataButtonDown(ev);
    this._mouseStartPoint = ev.point.clone();
    return EventHandled.Yes;
  }

  public override decorate(context: DecorateContext): void {
    super.decorate(context);

    if (!this.isCompatibleViewport(context.viewport, false) || !this.toolModel.dynamicMeasurement) return;

    this.toolModel.dynamicMeasurement.toolName = MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureWidth.width");

    if (this.toolModel.currentState === MeasureDistanceToolModel.State.SetEndPoint && this._mouseStartPoint) {
      const hypotenusePoints: Point3d[] = [this._mouseStartPoint, this.toolModel.dynamicMeasurement.endPointRef];
      this.createHypotenuseDecoration(context, hypotenusePoints);
      const heightPoints = this.getHeightPoints(hypotenusePoints);
      const viewType = MeasurementViewTarget.classifyViewport(context.viewport);

      this.toolModel.dynamicMeasurement.secondaryLine = [heightPoints[0], heightPoints[1]];
      this.toolModel.setStartPoint(viewType, heightPoints[1]);
      this.toolModel.setEndPoint(viewType, heightPoints[2], true);
    }
  }
}
