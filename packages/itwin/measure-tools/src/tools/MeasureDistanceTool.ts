/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type {
  BeButtonEvent,
  DecorateContext,
  ToolAssistanceInstruction,
  ToolAssistanceSection,
} from "@itwin/core-frontend";
import {
  AccuDrawHintBuilder,
  EventHandled,
  IModelApp,
  ToolAssistance,
  ToolAssistanceImage,
  ToolAssistanceInputMethod,
} from "@itwin/core-frontend";
import type { Feature } from "../api/FeatureTracking";
import { MeasureToolsFeatures } from "../api/FeatureTracking";
import { MeasurementToolBase } from "../api/MeasurementTool";
import { MeasurementViewTarget } from "../api/MeasurementViewTarget";
import type { DistanceMeasurement } from "../measurements/DistanceMeasurement";
import { MeasureTools } from "../MeasureTools";
import { MeasureDistanceToolModel } from "../toolmodels/MeasureDistanceToolModel";
import { SheetMeasurementsHelper } from "../api/SheetMeasurementHelper";
import type { Point3d } from "@itwin/core-geometry";

export class MeasureDistanceTool extends MeasurementToolBase<
DistanceMeasurement,
MeasureDistanceToolModel
> {
  public static override toolId = "MeasureTools.MeasureDistance";
  public static override iconSpec = "icon-measure-distance";
  private _enableSheetMeasurements;
  private _currentMousePoint?: Point3d;

  public static override get flyover() {
    return MeasureTools.localization.getLocalizedString(
      "MeasureTools:tools.MeasureDistance.flyover"
    );
  }
  public static override get description(): string {
    return MeasureTools.localization.getLocalizedString(
      "MeasureTools:tools.MeasureDistance.description",
    );
  }
  public static override get keyin(): string {
    return MeasureTools.localization.getLocalizedString(
      "MeasureTools:tools.MeasureDistance.keyin",
    );
  }

  protected override get feature(): Feature | undefined {
    return MeasureToolsFeatures.Tools_MeasureDistance;
  }

  constructor(enableSheetMeasurements = false) {
    super();
    this._enableSheetMeasurements = enableSheetMeasurements;
  }

  public async onRestartTool(): Promise<void> {
    const tool = new MeasureDistanceTool(this._enableSheetMeasurements);
    if (await tool.run()) return;

    return this.exitTool();
  }

  private resetSheetData(): void {
    this.toolModel.firstPointDrawingId = undefined;
    this.toolModel.drawingExtents = undefined;
    this.toolModel.drawingExtents = undefined;
    this.toolModel.setSheetToWorldScale(undefined);
  }

  public override async onReinitialize(): Promise<void> {
    await super.onReinitialize();
    this.resetSheetData();
    AccuDrawHintBuilder.deactivate();
  }

  public override async onDataButtonDown(
    ev: BeButtonEvent
  ): Promise<EventHandled> {
    if (!ev.viewport) return EventHandled.No;

    const viewType = MeasurementViewTarget.classifyViewport(ev.viewport);

    if (
      MeasureDistanceToolModel.State.SetMeasurementViewport ===
      this.toolModel.currentState
    ) {
      this.toolModel.setMeasurementViewport(viewType);
      this.toolModel.setStartPoint(viewType, ev.point);
      await this.sheetMeasurementsDataButtonDown(ev, true);
      this._sendHintsToAccuDraw(ev);
      this.updateToolAssistance();
    } else if (
      MeasureDistanceToolModel.State.SetEndPoint === this.toolModel.currentState
    ) {
      await this.sheetMeasurementsDataButtonDown(ev, false);
      this.toolModel.setEndPoint(viewType, ev.point, false);
      await this.onReinitialize();
    }

    ev.viewport.invalidateDecorations();
    return EventHandled.Yes;
  }

  private async sheetMeasurementsDataButtonDown(ev: BeButtonEvent, initial: boolean) {
    if (!ev.viewport) return;

    if (this._enableSheetMeasurements) {
      if (this.toolModel.firstPointDrawingId === undefined && ev.viewport.view.id !== undefined && initial) {
        const drawingInfo = await SheetMeasurementsHelper.getDrawingId(this.iModel, ev.viewport.view.id, ev.point);
        this.toolModel.firstPointDrawingId = drawingInfo?.id;
        if (this.toolModel.firstPointDrawingId) {
          this.toolModel.setSheetToWorldScale(drawingInfo?.scale);
          this.toolModel.drawingOrigin = drawingInfo?.origin;
          this.toolModel.drawingExtents = drawingInfo?.extents;
          this.toolModel.sheetViewId = ev.viewport.view.id;
        }
      } else {
        if (this.toolModel.firstPointDrawingId !== undefined) {
          if ((await SheetMeasurementsHelper.getDrawingId(this.iModel, ev.viewport.view.id, ev.point))?.id !== this.toolModel.firstPointDrawingId) {
            this.toolModel.drawingOrigin = undefined;
            this.toolModel.drawingExtents = undefined;
            this.toolModel.setSheetToWorldScale(undefined);
          }
        }
      }
    }
  }

  public override isValidLocation(ev: BeButtonEvent, _isButtonEvent: boolean): boolean {
    if (!this._enableSheetMeasurements || this.toolModel.firstPointDrawingId === undefined || this.toolModel.drawingOrigin === undefined || this.toolModel.drawingExtents === undefined)
      return true;

    return SheetMeasurementsHelper.checkIfInDrawing(ev.point, this.toolModel.drawingOrigin, this.toolModel.drawingExtents);
  }

  public override decorate(context: DecorateContext): void {
    super.decorate(context);

    if (this._enableSheetMeasurements && this._currentMousePoint !== undefined && this.toolModel.drawingOrigin !== undefined && this.toolModel.drawingExtents !== undefined && !SheetMeasurementsHelper.checkIfInDrawing(this._currentMousePoint, this.toolModel.drawingOrigin, this.toolModel.drawingExtents)) {
      context.addDecorationFromBuilder(SheetMeasurementsHelper.getDrawingContourGraphic(context, this.toolModel.drawingOrigin, this.toolModel.drawingExtents));
    }
  }

  private _sendHintsToAccuDraw(ev: BeButtonEvent): void {
    const hints = new AccuDrawHintBuilder();
    hints.setOrigin(ev.point);
    hints.setModeRectangular();
    hints.sendHints(false);
    IModelApp.toolAdmin.setCursor(IModelApp.viewManager.crossHairCursor);
  }

  public override async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    if (
      undefined === ev.viewport ||
      MeasureDistanceToolModel.State.SetEndPoint !== this.toolModel.currentState
    )
      return;
    const type = MeasurementViewTarget.classifyViewport(ev.viewport);
    this.toolModel.setEndPoint(type, ev.point, true);
    this._currentMousePoint = ev.point;
    ev.viewport.invalidateDecorations();
  }

  protected createToolModel(): MeasureDistanceToolModel {
    return new MeasureDistanceToolModel();
  }

  protected override updateToolAssistance(): void {
    let promptMainInstruction: string;
    if (
      MeasureDistanceToolModel.State.SetEndPoint !== this.toolModel.currentState
    )
      promptMainInstruction = MeasureTools.localization.getLocalizedString(
        "MeasureTools:tools.MeasureDistance.mainInstruction"
      );
    else
      promptMainInstruction = MeasureTools.localization.getLocalizedString(
        "MeasureTools:tools.MeasureDistance.mainInstruction2"
      );

    const promptClickTap = MeasureTools.localization.getLocalizedString(
      "MeasureTools:tools.GenericPrompts.acceptPoint"
    );

    let promptRightClick: string;
    if (undefined !== this.toolModel.dynamicMeasurement)
      promptRightClick = MeasureTools.localization.getLocalizedString(
        "MeasureTools:tools.GenericPrompts.clearCurrentMeasurement"
      );
    else
      promptRightClick = MeasureTools.localization.getLocalizedString(
        "MeasureTools:tools.GenericPrompts.restart"
      );

    const mainInstruction = ToolAssistance.createInstruction(
      this.iconSpec,
      promptMainInstruction
    );
    const mouseInstructions: ToolAssistanceInstruction[] = [];
    const touchInstructions: ToolAssistanceInstruction[] = [];

    if (!ToolAssistance.createTouchCursorInstructions(touchInstructions))
      touchInstructions.push(
        ToolAssistance.createInstruction(
          ToolAssistanceImage.OneTouchTap,
          promptClickTap,
          false,
          ToolAssistanceInputMethod.Touch
        )
      );
    mouseInstructions.push(
      ToolAssistance.createInstruction(
        ToolAssistanceImage.LeftClick,
        promptClickTap,
        false,
        ToolAssistanceInputMethod.Mouse
      )
    );
    mouseInstructions.push(
      ToolAssistance.createInstruction(
        ToolAssistanceImage.RightClick,
        promptRightClick,
        false,
        ToolAssistanceInputMethod.Mouse
      )
    );

    if (undefined === this.toolModel.dynamicMeasurement) {
      if (this.toolModel.canUndo)
        mouseInstructions.push(this.createMouseUndoInstruction());
      if (this.toolModel.canRedo)
        mouseInstructions.push(this.createMouseRedoInstruction());
    }

    const sections: ToolAssistanceSection[] = [
      ToolAssistance.createSection(
        mouseInstructions,
        ToolAssistance.inputsLabel
      ),
      ToolAssistance.createSection(
        touchInstructions,
        ToolAssistance.inputsLabel
      ),
    ];
    const instructions = ToolAssistance.createInstructions(
      mainInstruction,
      sections
    );
    IModelApp.notifications.setToolAssistance(instructions);
  }
}
