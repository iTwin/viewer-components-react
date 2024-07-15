/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { MeasureDistanceTool } from "./MeasureDistanceTool";
import { MeasureTools } from "../MeasureTools";
import { MeasureDistanceToolModel } from "../toolmodels/MeasureDistanceToolModel";
import { Point3d } from "@itwin/core-geometry";
import { GraphicType } from "@itwin/core-frontend";
import { ColorDef, LinePixels } from "@itwin/core-common";
import type { DecorateContext } from "@itwin/core-frontend";

export class MeasureWidthTool extends MeasureDistanceTool {
  public static override toolId = "MeasureTools.MeasureWidth";
  public static override iconSpec = "icon-measure-width";

  public static override get flyover() {
    return MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureWidth.flyover");
  }
  public static override get description(): string {
    return MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureWidth.description");
  }
  public static override get keyin(): string {
    return MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureWidth.keyin");
  }

  public override decorate(context: DecorateContext): void {
    super.decorate(context);

    if (this.toolModel.dynamicMeasurement)
      this.toolModel.dynamicMeasurement.toolName = MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureWidth.width");

    this.createDecorations(context);
  }

  protected createDecorations(context: DecorateContext): void {
    if (!this.isCompatibleViewport(context.viewport, false)) {
      return;
    }

    if (this.toolModel.currentState === MeasureDistanceToolModel.State.SetEndPoint && this.toolModel.dynamicMeasurement) {
      const blueHighlight = context.viewport.hilite.color;
      const hypotenusePoints: Point3d[] = [this.toolModel.dynamicMeasurement.startPointRef, this.toolModel.dynamicMeasurement.endPointRef];

      const hypotenuseLine = context.createGraphicBuilder(GraphicType.WorldDecoration);
      hypotenuseLine.setSymbology(blueHighlight, ColorDef.black, 3);
      hypotenuseLine.addLineString(hypotenusePoints);
      context.addDecorationFromBuilder(hypotenuseLine);

      const hypotenuseDashLine = context.createGraphicBuilder(GraphicType.WorldOverlay);
      hypotenuseDashLine.setSymbology(blueHighlight, ColorDef.black, 1, LinePixels.Code2);
      hypotenuseDashLine.addLineString(hypotenusePoints);
      context.addDecorationFromBuilder(hypotenuseDashLine);

      const heightPoints: Point3d[] = [];
      heightPoints.push(hypotenusePoints[0].clone());
      if (hypotenusePoints[0].z > hypotenusePoints[1].z)
        heightPoints.push(new Point3d(hypotenusePoints[0].x, hypotenusePoints[0].y, hypotenusePoints[1].z));
      else
        heightPoints.push(new Point3d(hypotenusePoints[1].x, hypotenusePoints[1].y, hypotenusePoints[0].z));
      heightPoints.push(hypotenusePoints[1].clone());

      if (heightPoints.length === 3)
        this.toolModel.dynamicMeasurement.measureLine = [heightPoints[1], heightPoints[2]];
      this.toolModel.dynamicMeasurement.secondaryLine = heightPoints;
    }
  }
}
