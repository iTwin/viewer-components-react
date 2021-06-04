/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  BeButtonEvent,
  IModelApp,
  EventHandled,
  ToolAssistance,
  ToolAssistanceImage,
  ToolAssistanceInputMethod,
  ToolAssistanceInstruction,
  ToolAssistanceSection,
} from "@bentley/imodeljs-frontend";
import { AngleMeasurement } from "../measurements/AngleMeasurement";
import { MeasurementToolBase } from "../api/MeasurementTool";
import { MeasurementViewTarget } from "../api/MeasurementViewTarget";
import { MeasureAngleToolModel } from "../toolmodels/MeasureAngleToolModel";
import { Feature, MeasureToolsFeatures } from "../api/FeatureTracking";

/** Tool for measuring angles using start, center and end point */
export class MeasureAngleTool extends MeasurementToolBase<
  AngleMeasurement,
  MeasureAngleToolModel
> {
  protected createToolModel(): MeasureAngleToolModel {
    return new MeasureAngleToolModel();
  }

  public static toolId = "MeasureAngle";
  // TODO: Change icon once UX team provides icon
  public static iconSpec = "icon-angle-measure";
  public static get label() {
    return IModelApp.i18n.translate("MeasureTools:tools.MeasureAngle.flyover");
  }
  public static get flyover() {
    return IModelApp.i18n.translate("MeasureTools:tools.MeasureAngle.flyover");
  }

  protected get feature(): Feature | undefined { return MeasureToolsFeatures.Tools_MeasureAngle; }

  constructor() {
    super();
  }

  public onRestartTool(): void {
    const tool = new MeasureAngleTool();
    if (!tool.run()) this.exitTool();
  }

  /** Show tool assistance messages to user */
  public showPrompt() {
    const identifyStartMessage = IModelApp.i18n.translate(
      "MeasureTools:tools.MeasureAngle.identifyStart",
    );
    const identifyCenterMessage = IModelApp.i18n.translate(
      "MeasureTools:tools.MeasureAngle.identifyCenter",
    );
    const identifyEndMessage = IModelApp.i18n.translate(
      "MeasureTools:tools.MeasureAngle.identifyEnd",
    );
    let currentMsg = "";
    if (
      this.toolModel.currentState ===
        MeasureAngleToolModel.State.SetMeasurementViewport ||
      this.toolModel.currentState === MeasureAngleToolModel.State.SetStartPoint
    ) {
      currentMsg = identifyStartMessage;
    } else if (
      this.toolModel.currentState === MeasureAngleToolModel.State.SetCenter
    ) {
      currentMsg = identifyCenterMessage;
    } else if (
      this.toolModel.currentState === MeasureAngleToolModel.State.SetEndPoint
    ) {
      currentMsg = identifyEndMessage;
    }

    const mainInstruction = ToolAssistance.createInstruction(
      this.iconSpec,
      currentMsg,
    );
    const mouseInstructions: ToolAssistanceInstruction[] = [];
    mouseInstructions.push(
      ToolAssistance.createInstruction(
        ToolAssistanceImage.LeftClick,
        identifyStartMessage,
        false,
        ToolAssistanceInputMethod.Mouse,
      ),
    );
    mouseInstructions.push(
      ToolAssistance.createInstruction(
        ToolAssistanceImage.LeftClick,
        identifyCenterMessage,
        false,
        ToolAssistanceInputMethod.Mouse,
      ),
    );
    mouseInstructions.push(
      ToolAssistance.createInstruction(
        ToolAssistanceImage.LeftClick,
        identifyEndMessage,
        false,
        ToolAssistanceInputMethod.Mouse,
      ),
    );

    if (undefined === this.toolModel.dynamicMeasurement) {
      if (this.toolModel.canUndo)
        mouseInstructions.push(this.createMouseUndoInstruction());
      if (this.toolModel.canRedo)
        mouseInstructions.push(this.createMouseRedoInstruction());
    }

    const sections: ToolAssistanceSection[] = [];
    sections.push(
      ToolAssistance.createSection(
        mouseInstructions,
        ToolAssistance.inputsLabel,
      ),
    );

    const instructions = ToolAssistance.createInstructions(
      mainInstruction,
      sections,
    );
    IModelApp.notifications.setToolAssistance(instructions);
  }

  /** Setup for next tool step */
  protected updateToolAssistance(): void {
    IModelApp.accuSnap.enableSnap(true);

    this.showPrompt();
  }

  public async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    if (
      undefined === ev.viewport ||
      MeasureAngleToolModel.State.SetEndPoint !== this.toolModel.currentState
    )
      return;

    const type = MeasurementViewTarget.classifyViewport(ev.viewport);
    this.toolModel.setEndPoint(type, ev.point, true);
    ev.viewport.invalidateDecorations();
  }

  /** Process mouse presses */
  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (!ev.viewport) return EventHandled.No;

    const viewType = MeasurementViewTarget.classifyViewport(ev.viewport);
    let success = false;

    switch (this.toolModel.currentState) {
      case MeasureAngleToolModel.State.SetMeasurementViewport: {
        success = this.toolModel.setMeasurementViewport(viewType);
        if (success)
          success = this.toolModel.setStartPoint(viewType, ev.point, false);
        break;
      }
      case MeasureAngleToolModel.State.SetCenter: {
        success = this.toolModel.setCenter(viewType, ev.point, false);
        break;
      }
      case MeasureAngleToolModel.State.SetEndPoint: {
        success = this.toolModel.setEndPoint(viewType, ev.point, false);
        break;
      }
    }

    if (success) this.updateToolAssistance();

    ev.viewport.invalidateDecorations();
    return EventHandled.Yes;
  }
}
