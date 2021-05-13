/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BeButtonEvent, EventHandled, IModelApp, ToolAssistance, ToolAssistanceInstruction, ToolAssistanceImage, ToolAssistanceSection, ToolAssistanceInputMethod, AccuDrawHintBuilder } from "@bentley/imodeljs-frontend";
import { MeasurementToolBase } from "../api/MeasurementTool";
import { MeasurementViewTarget } from "../api/MeasurementViewTarget";
import { AreaMeasurement } from "../measurements/AreaMeasurement";
import { MeasureAreaToolModel } from "../toolmodels/MeasureAreaToolModel";
import { MeasureToolsFeatures, Feature } from "../api/FeatureTracking";
import { Vector3d, Matrix3d, AxisOrder } from "@bentley/geometry-core";

export class MeasureAreaTool extends MeasurementToolBase<AreaMeasurement, MeasureAreaToolModel> {

  public static toolId = "MeasureArea";
  public static iconSpec = "icon-measure-2d";

  protected get feature(): Feature | undefined { return MeasureToolsFeatures.Tools_MeasureArea; }

  constructor() {
    super();
  }

  public onRestartTool(): void {
    const tool = new MeasureAreaTool();
    if (!tool.run())
      this.exitTool();
  }

  public onReinitialize(): void {
    super.onReinitialize();
    AccuDrawHintBuilder.deactivate();
  }

  public async onUndoPreviousStep(): Promise<boolean> {
    if (this.toolModel.popMeasurementPoint()) {
      const ev = new BeButtonEvent();
      this.getCurrentButtonEvent(ev);

      // Update the dynamic polygon
      await this.onMouseMotion(ev);

      this._sendHintsToAccuDraw(ev);
      this.updateToolAssistance();
      return true;
    }

    return super.onUndoPreviousStep();
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (!ev.viewport)
      return EventHandled.No;

    const viewType = MeasurementViewTarget.classifyViewport(ev.viewport);

    if (MeasureAreaToolModel.State.SetMeasurementViewport === this.toolModel.currentState) {
      this.toolModel.setMeasurementViewport(viewType);
    }

    this.toolModel.addPoint(viewType, ev.point, false);
    if (undefined === this.toolModel.dynamicMeasurement) {
      this.onReinitialize();
    } else {
      this._sendHintsToAccuDraw(ev);
      this.updateToolAssistance();
    }

    ev.viewport.invalidateDecorations();
    return EventHandled.Yes;
  }

  private _sendHintsToAccuDraw(ev: BeButtonEvent): void {
    const dynamicMeasurement = this.toolModel.dynamicMeasurement;
    if (undefined === ev.viewport || undefined === dynamicMeasurement)
      return;

    const points = dynamicMeasurement.polygonPoints;
    if (0 === points.length)
      return;

    const hints = new AccuDrawHintBuilder();
    hints.setOrigin(points[points.length - 1]);

    if (1 === points.length) {
      hints.setModeRectangular();
    } else {
      // Adjust to keep orientation defined by the last 2 points and the surface normal (if any).
      const snapDetail = IModelApp.accuSnap.getCurrSnapDetail();
      if (undefined !== snapDetail && undefined !== snapDetail.normal) {
        const normal = Vector3d.createZero();
        const xVector = Vector3d.createStartEnd(points[points.length - 2], points[points.length - 1]);
        const zVector = ev.viewport.view.getZVector();
        if (zVector.dotProduct(snapDetail.normal) < 0.0)
          normal.setFrom(snapDetail.normal);
        else
          snapDetail.normal.negate(normal);

        const mat = Matrix3d.createRigidFromColumns(xVector, normal, AxisOrder.XZY);
        if (undefined !== mat)
          hints.setRotation(mat.inverse()!);
      }
    }
    hints.sendHints(true);
    IModelApp.toolAdmin.setCursor(IModelApp.viewManager.crossHairCursor);
  }

  public async onResetButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    // Attempt to close polygon
    if (this.toolModel.tryCommitMeasurement()) {
      this.onReinitialize();
      return EventHandled.Yes;
    }

    return super.onResetButtonDown(ev);
  }

  public async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    if (!ev.viewport)
      return;

    const viewType = MeasurementViewTarget.classifyViewport(ev.viewport);
    if (this.toolModel.addPoint(viewType, ev.point, true))
      ev.viewport.invalidateDecorations();
  }

  protected createToolModel(): MeasureAreaToolModel {
    return new MeasureAreaToolModel();
  }

  protected updateToolAssistance(): void {
    const hasPoints = undefined !== this.toolModel.dynamicMeasurement;
    const hasEnoughPoints = hasPoints && this.toolModel.hasEnoughPoints;

    let promptMainInstruction: string;
    if (hasEnoughPoints)
      promptMainInstruction = IModelApp.i18n.translate("MeasureTools:tools.MeasureArea.mainInstructionClose");
    else
      promptMainInstruction = IModelApp.i18n.translate("MeasureTools:tools.MeasureArea.mainInstruction");

    const promptClickTap = IModelApp.i18n.translate("MeasureTools:tools.GenericPrompts.acceptPoint");

    let promptRightClick: string;
    if (hasEnoughPoints)
      promptRightClick = IModelApp.i18n.translate("MeasureTools:tools.MeasureArea.rightClickCloseShape");
    else if (hasPoints)
      promptRightClick = IModelApp.i18n.translate("MeasureTools:tools.MeasureArea.rightClickClearShape");
    else
      promptRightClick = IModelApp.i18n.translate("MeasureTools:tools.GenericPrompts.restart");

    const mainInstruction = ToolAssistance.createInstruction(this.iconSpec, promptMainInstruction);
    const mouseInstructions: ToolAssistanceInstruction[] = [];
    const touchInstructions: ToolAssistanceInstruction[] = [];

    if (!ToolAssistance.createTouchCursorInstructions(touchInstructions)) {
      touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.OneTouchTap, promptClickTap, false, ToolAssistanceInputMethod.Touch));
      if (hasEnoughPoints) {
        const tmp = IModelApp.i18n.translate("MeasureTools:tools.MeasureArea.oneTouchTapClose");
        touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.OneTouchTap, tmp, false, ToolAssistanceInputMethod.Touch));
      }
    }
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.LeftClick, promptClickTap, false, ToolAssistanceInputMethod.Mouse));
    if (hasEnoughPoints) {
      const tmp = IModelApp.i18n.translate("MeasureTools:tools.MeasureArea.leftClickClose");
      mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.LeftClick, tmp, false, ToolAssistanceInputMethod.Mouse));
    }
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.RightClick, promptRightClick, false, ToolAssistanceInputMethod.Mouse));

    if (undefined !== this.toolModel.dynamicMeasurement) {
      const undoPointText = IModelApp.i18n.translate("MeasureTools:tools.MeasureArea.undoLastPoint");
      mouseInstructions.push(this.createMouseUndoInstruction(undoPointText));
    } else {
      if (this.toolModel.canUndo)
        mouseInstructions.push(this.createMouseUndoInstruction());
      if (this.toolModel.canRedo)
        mouseInstructions.push(this.createMouseRedoInstruction());
    }

    const sections: ToolAssistanceSection[] = [
      ToolAssistance.createSection(mouseInstructions, ToolAssistance.inputsLabel),
      ToolAssistance.createSection(touchInstructions, ToolAssistance.inputsLabel),
    ];
    const instructions = ToolAssistance.createInstructions(mainInstruction, sections);
    IModelApp.notifications.setToolAssistance(instructions);
  }
}
