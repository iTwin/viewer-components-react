/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BeButtonEvent, EventHandled, IModelApp, ToolAssistance, ToolAssistanceInstruction, ToolAssistanceImage, ToolAssistanceSection, ToolAssistanceInputMethod, AccuDrawHintBuilder } from "@bentley/imodeljs-frontend";
import { MeasureDistanceToolModel } from "../toolmodels/MeasureDistanceToolModel";
import { MeasurementToolBase } from "../api/MeasurementTool";
import { MeasurementViewTarget } from "../api/MeasurementViewTarget";
import { DistanceMeasurement } from "../measurements/DistanceMeasurement";
import { Feature, MeasureToolsFeatures } from "../api/FeatureTracking";

export class MeasureDistanceTool extends MeasurementToolBase<DistanceMeasurement, MeasureDistanceToolModel> {

  public static toolId = "MeasureDistance";
  public static iconSpec = "icon-measure-distance";

  protected get feature(): Feature | undefined { return MeasureToolsFeatures.Tools_MeasureDistance; }

  constructor() {
    super();
  }

  public onRestartTool(): void {
    const tool = new MeasureDistanceTool();
    if (!tool.run())
      this.exitTool();
  }

  public onReinitialize(): void {
    super.onReinitialize();
    AccuDrawHintBuilder.deactivate();
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (!ev.viewport)
      return EventHandled.No;

    const viewType = MeasurementViewTarget.classifyViewport(ev.viewport);

    if (MeasureDistanceToolModel.State.SetMeasurementViewport === this.toolModel.currentState) {
      this.toolModel.setMeasurementViewport(viewType);
      this.toolModel.setStartPoint(viewType, ev.point);
      this._sendHintsToAccuDraw(ev);
      this.updateToolAssistance();
    } else if (MeasureDistanceToolModel.State.SetEndPoint === this.toolModel.currentState) {
      this.toolModel.setEndPoint(viewType, ev.point, false);
      this.onReinitialize();
    }

    ev.viewport.invalidateDecorations();
    return EventHandled.Yes;
  }

  private _sendHintsToAccuDraw(ev: BeButtonEvent): void {
    const hints = new AccuDrawHintBuilder();
    hints.setOrigin(ev.point);
    hints.setModeRectangular();
    hints.sendHints(true);
    IModelApp.toolAdmin.setCursor(IModelApp.viewManager.crossHairCursor);
  }

  public async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    if (undefined === ev.viewport || MeasureDistanceToolModel.State.SetEndPoint !== this.toolModel.currentState)
      return;
    const type = MeasurementViewTarget.classifyViewport(ev.viewport);
    this.toolModel.setEndPoint(type, ev.point, true);
    ev.viewport.invalidateDecorations();
  }

  protected createToolModel(): MeasureDistanceToolModel {
    return new MeasureDistanceToolModel();
  }

  protected updateToolAssistance(): void {

    let promptMainInstruction: string;
    if (MeasureDistanceToolModel.State.SetEndPoint !== this.toolModel.currentState)
      promptMainInstruction = IModelApp.i18n.translate("MeasureTools:tools.MeasureDistance.mainInstruction");
    else
      promptMainInstruction = IModelApp.i18n.translate("MeasureTools:tools.MeasureDistance.mainInstruction2");

    const promptClickTap = IModelApp.i18n.translate("MeasureTools:tools.GenericPrompts.acceptPoint");

    let promptRightClick: string;
    if (undefined !== this.toolModel.dynamicMeasurement)
      promptRightClick = IModelApp.i18n.translate("MeasureTools:tools.GenericPrompts.clearCurrentMeasurement");
    else
      promptRightClick = IModelApp.i18n.translate("MeasureTools:tools.GenericPrompts.restart");

    const mainInstruction = ToolAssistance.createInstruction(this.iconSpec, promptMainInstruction);
    const mouseInstructions: ToolAssistanceInstruction[] = [];
    const touchInstructions: ToolAssistanceInstruction[] = [];

    if (!ToolAssistance.createTouchCursorInstructions(touchInstructions))
      touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.OneTouchTap, promptClickTap, false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.LeftClick, promptClickTap, false, ToolAssistanceInputMethod.Mouse));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.RightClick, promptRightClick, false, ToolAssistanceInputMethod.Mouse));

    if (undefined === this.toolModel.dynamicMeasurement) {
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
