/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { MeasureTools } from "../MeasureTools";
import { MeasureDistanceToolModel } from "../toolmodels/MeasureDistanceToolModel";
import {
  AccuDrawHintBuilder,
  EventHandled,
  GraphicType,
  IModelApp,
  ToolAssistance,
  ToolAssistanceImage,
  ToolAssistanceInputMethod,
  type ToolAssistanceInstruction,
  type ToolAssistanceSection,
} from "@itwin/core-frontend";
import type { BeButtonEvent, DecorateContext } from "@itwin/core-frontend";
import type { PerpendicularDistanceMeasurement } from "../measurements/PerpendicularDistanceMeasurement";
import { MeasurementToolBase } from "../api/MeasurementTool";
import { type Feature, MeasureToolsFeatures } from "../api/FeatureTracking";
import { DrawingDataCache } from "../api/DrawingTypeDataCache";
import { SheetMeasurementsHelper } from "../api/SheetMeasurementHelper";
import type { DrawingMetadata } from "../api/Measurement";
import { MeasurePerpendicularDistanceToolModel } from "../toolmodels/MeasurePerpendicularDistanceToolModel";
import { MeasurementViewTarget } from "../api/MeasurementViewTarget";
import { Point3d } from "@itwin/core-geometry";
import { ColorDef, LinePixels } from "@itwin/core-common";

/**
 * Wrapper tool for common functionality between height and width measurement tools.
 */
export class MeasurePerpendicularDistanceTool extends MeasurementToolBase<PerpendicularDistanceMeasurement, MeasurePerpendicularDistanceToolModel> {
  private _enableSheetMeasurements: boolean;

  protected override get feature(): Feature | undefined {
    return MeasureToolsFeatures.Tools_MeasureDistance;
  }

  constructor(enableSheetMeasurements = false) {
    super();
    this._enableSheetMeasurements = enableSheetMeasurements;
  }

  public async onRestartTool(): Promise<void> {
    const tool = new MeasurePerpendicularDistanceTool(this._enableSheetMeasurements);
    if (await tool.run()) return;

    return this.exitTool();
  }

  public override async onReinitialize(): Promise<void> {
    await super.onReinitialize();
    AccuDrawHintBuilder.deactivate();
  }

  protected async sheetMeasurementsDataButtonDown(ev: BeButtonEvent) {
    if (!ev.viewport) return;

    if (this._enableSheetMeasurements) {
      if (this.toolModel.drawingMetadata?.drawingId === undefined && ev.viewport.view.id !== undefined) {
        const drawingInfo = await SheetMeasurementsHelper.getDrawingId(this.iModel, ev.viewport.view.id, ev.point);
        this.toolModel.sheetViewId = ev.viewport.view.id;

        if (drawingInfo?.drawingId !== undefined && drawingInfo.origin !== undefined && drawingInfo.worldScale !== undefined) {
          const data: DrawingMetadata = {
            origin: drawingInfo.origin,
            drawingId: drawingInfo.drawingId,
            worldScale: drawingInfo.worldScale,
            extents: drawingInfo.extents,
          };
          this.toolModel.drawingMetadata = data;
        }
      }
    }
  }

  protected _sendHintsToAccuDraw(ev: BeButtonEvent): void {
    const hints = new AccuDrawHintBuilder();
    hints.setOrigin(ev.point);
    hints.setModeRectangular();
    hints.sendHints(false);
    IModelApp.toolAdmin.setCursor(IModelApp.viewManager.crossHairCursor);
  }

  public override isValidLocation(ev: BeButtonEvent, _isButtonEvent: boolean): boolean {
    if (!this._enableSheetMeasurements) return true;

    if (true !== ev.viewport?.view.isSheetView()) return true;

    for (const drawing of DrawingDataCache.getInstance().getSheetDrawingDataForViewport(ev.viewport)) {
      if (drawing.type !== SheetMeasurementsHelper.DrawingType.CrossSection && drawing.type !== SheetMeasurementsHelper.DrawingType.Plan) {
        if (SheetMeasurementsHelper.checkIfInDrawing(ev.point, drawing.origin, drawing.extents)) {
          return false;
        }
      }
    }

    if (
      this.toolModel.drawingMetadata?.drawingId === undefined ||
      this.toolModel.drawingMetadata?.origin === undefined ||
      this.toolModel.drawingMetadata?.extents === undefined
    )
      return true;

    return SheetMeasurementsHelper.checkIfInDrawing(ev.point, this.toolModel.drawingMetadata?.origin, this.toolModel.drawingMetadata?.extents);
  }

  public override decorate(context: DecorateContext): void {
    super.decorate(context);

    if (this._enableSheetMeasurements && this.toolModel.drawingMetadata?.origin !== undefined && this.toolModel.drawingMetadata?.extents !== undefined) {
      context.addDecorationFromBuilder(
        SheetMeasurementsHelper.getDrawingContourGraphic(context, this.toolModel.drawingMetadata?.origin, this.toolModel.drawingMetadata?.extents),
      );
    }
  }

  protected createToolModel(): MeasurePerpendicularDistanceToolModel {
    return new MeasurePerpendicularDistanceToolModel();
  }

  protected override updateToolAssistance(): void {
    let promptMainInstruction: string;
    if (this.toolModel.currentState !== MeasureDistanceToolModel.State.SetEndPoint)
      promptMainInstruction = MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureDistance.mainInstruction");
    else promptMainInstruction = MeasureTools.localization.getLocalizedString("MeasureTools:tools.MeasureDistance.mainInstruction2");

    const promptClickTap = MeasureTools.localization.getLocalizedString("MeasureTools:tools.GenericPrompts.acceptPoint");

    let promptRightClick: string;
    if (this.toolModel.dynamicMeasurement)
      promptRightClick = MeasureTools.localization.getLocalizedString("MeasureTools:tools.GenericPrompts.clearCurrentMeasurement");
    else promptRightClick = MeasureTools.localization.getLocalizedString("MeasureTools:tools.GenericPrompts.restart");

    const mainInstruction = ToolAssistance.createInstruction(this.iconSpec, promptMainInstruction);
    const mouseInstructions: ToolAssistanceInstruction[] = [];
    const touchInstructions: ToolAssistanceInstruction[] = [];

    if (!ToolAssistance.createTouchCursorInstructions(touchInstructions))
      touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.OneTouchTap, promptClickTap, false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.LeftClick, promptClickTap, false, ToolAssistanceInputMethod.Mouse));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.RightClick, promptRightClick, false, ToolAssistanceInputMethod.Mouse));

    if (!this.toolModel.dynamicMeasurement) {
      if (this.toolModel.canUndo) mouseInstructions.push(this.createMouseUndoInstruction());
      if (this.toolModel.canRedo) mouseInstructions.push(this.createMouseRedoInstruction());
    }

    const sections: ToolAssistanceSection[] = [
      ToolAssistance.createSection(mouseInstructions, ToolAssistance.inputsLabel),
      ToolAssistance.createSection(touchInstructions, ToolAssistance.inputsLabel),
    ];
    const instructions = ToolAssistance.createInstructions(mainInstruction, sections);
    IModelApp.notifications.setToolAssistance(instructions);
  }

  public override async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (!ev.viewport) {
      return EventHandled.No;
    }

    const viewType = MeasurementViewTarget.classifyViewport(ev.viewport);

    if (MeasureDistanceToolModel.State.SetMeasurementViewport === this.toolModel.currentState) {
      this.toolModel.setMeasurementViewport(viewType);
      this.toolModel.setStartPoint(viewType, ev.point);
      await this.sheetMeasurementsDataButtonDown(ev);
      this._sendHintsToAccuDraw(ev);
      this.updateToolAssistance();
    } else if (MeasureDistanceToolModel.State.SetEndPoint === this.toolModel.currentState) {
      this.toolModel.setEndPoint(viewType, ev.point, false);
      await this.onReinitialize();
    }

    ev.viewport.invalidateDecorations();
    return EventHandled.Yes;
  }

  public override async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    if (undefined === ev.viewport || MeasureDistanceToolModel.State.SetEndPoint !== this.toolModel.currentState) {
      return;
    }
    const type = MeasurementViewTarget.classifyViewport(ev.viewport);
    this.toolModel.setEndPoint(type, ev.point, true);
    ev.viewport.invalidateDecorations();
  }

  /**
   * Creates decoration for the hypotenuse line of the perpendicular measurement.
   */
  protected createHypotenuseDecoration(context: DecorateContext, hypotenusePoints: Point3d[]) {
    const blueHighlight = context.viewport.hilite.color;

    const hypotenuseLine = context.createGraphicBuilder(GraphicType.WorldDecoration);
    hypotenuseLine.setSymbology(blueHighlight, ColorDef.black, 3);
    hypotenuseLine.addLineString(hypotenusePoints);
    context.addDecorationFromBuilder(hypotenuseLine);

    const hypotenuseDashLine = context.createGraphicBuilder(GraphicType.WorldOverlay);
    hypotenuseDashLine.setSymbology(blueHighlight, ColorDef.black, 1, LinePixels.Code2);
    hypotenuseDashLine.addLineString(hypotenusePoints);
    context.addDecorationFromBuilder(hypotenuseDashLine);
  }

  /**
   * Returns the points for the base and perpendicular lines of a right triangle formed from the hypotenuse.
   */
  protected getHeightPoints(hypotenusePoints: Point3d[]): Point3d[] {
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
}
