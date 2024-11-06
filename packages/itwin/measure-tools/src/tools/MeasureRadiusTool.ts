/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type {
  BeButtonEvent,
  ScreenViewport,
  ToolAssistanceInstruction,
  ToolAssistanceSection,
} from "@itwin/core-frontend";
import {
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
import type { RadiusMeasurement } from "../measurements/RadiusMeasurement";
import { MeasureTools } from "../MeasureTools";
import { MeasureRadiusToolModel } from "../toolmodels/MeasureRadiusToolModel";

/** Tool for measuring radius using 3-points */
export class MeasureRadiusTool extends MeasurementToolBase<
RadiusMeasurement,
MeasureRadiusToolModel
> {
  protected createToolModel(): MeasureRadiusToolModel {
    return new MeasureRadiusToolModel();
  }

  public static override toolId = "MeasureTools.MeasureRadius";
  // TODO: Change icon once UX team provides icon
  public static override iconSpec = "icon-three-points-circular-arc";

  public static override get flyover() {
    return MeasureTools.localization.getLocalizedString(
      "MeasureTools:tools.MeasureRadius.flyover"
    );
  }
  public static override get description(): string {
    return MeasureTools.localization.getLocalizedString(
      "MeasureTools:tools.MeasureRadius.description",
    );
  }
  public static override get keyin(): string {
    return MeasureTools.localization.getLocalizedString(
      "MeasureTools:tools.MeasureRadius.keyin",
    );
  }

  protected override get feature(): Feature | undefined {
    return MeasureToolsFeatures.Tools_MeasureRadius;
  }

  constructor(allowedViewportCallback: (vp: ScreenViewport) => boolean = (() => true)) {
    super(allowedViewportCallback);
  }

  public async onRestartTool(): Promise<void> {
    const tool = new MeasureRadiusTool(this._allowedViewportCallback);
    if (await tool.run()) return;

    return this.exitTool();
  }

  /** Show tool assistance messages to user */
  public showPrompt() {
    const identifyStartMessage = MeasureTools.localization.getLocalizedString(
      "MeasureTools:tools.MeasureRadius.identifyStart"
    );
    const identifyCenterMessage = MeasureTools.localization.getLocalizedString(
      "MeasureTools:tools.MeasureRadius.identifyMidpoint"
    );
    const identifyEndMessage = MeasureTools.localization.getLocalizedString(
      "MeasureTools:tools.MeasureRadius.identifyEnd"
    );
    let currentMsg = "";
    if (
      this.toolModel.currentState ===
        MeasureRadiusToolModel.State.SetMeasurementViewport ||
      this.toolModel.currentState === MeasureRadiusToolModel.State.SetStartPoint
    ) {
      currentMsg = identifyStartMessage;
    } else if (
      this.toolModel.currentState === MeasureRadiusToolModel.State.SetMidPoint
    ) {
      currentMsg = identifyCenterMessage;
    } else if (
      this.toolModel.currentState === MeasureRadiusToolModel.State.SetEndPoint
    ) {
      currentMsg = identifyEndMessage;
    }

    const mainInstruction = ToolAssistance.createInstruction(
      this.iconSpec,
      currentMsg
    );
    const mouseInstructions: ToolAssistanceInstruction[] = [];
    mouseInstructions.push(
      ToolAssistance.createInstruction(
        ToolAssistanceImage.LeftClick,
        identifyStartMessage,
        false,
        ToolAssistanceInputMethod.Mouse
      )
    );
    mouseInstructions.push(
      ToolAssistance.createInstruction(
        ToolAssistanceImage.LeftClick,
        identifyCenterMessage,
        false,
        ToolAssistanceInputMethod.Mouse
      )
    );
    mouseInstructions.push(
      ToolAssistance.createInstruction(
        ToolAssistanceImage.LeftClick,
        identifyEndMessage,
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

    const sections: ToolAssistanceSection[] = [];
    sections.push(
      ToolAssistance.createSection(
        mouseInstructions,
        ToolAssistance.inputsLabel
      )
    );

    const instructions = ToolAssistance.createInstructions(
      mainInstruction,
      sections
    );
    IModelApp.notifications.setToolAssistance(instructions);
  }

  /** Setup for next tool step */
  protected override updateToolAssistance(): void {
    IModelApp.accuSnap.enableSnap(true);

    this.showPrompt();
  }

  public override async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    if (
      undefined === ev.viewport ||
      MeasureRadiusToolModel.State.SetEndPoint !== this.toolModel.currentState
    )
      return;

    const type = MeasurementViewTarget.classifyViewport(ev.viewport);
    this.toolModel.setEndPoint(type, ev.point, true);
    ev.viewport.invalidateDecorations();
  }

  /** Process mouse presses */
  public override async onDataButtonDown(
    ev: BeButtonEvent
  ): Promise<EventHandled> {
    if (!ev.viewport) return EventHandled.No;

    const viewType = MeasurementViewTarget.classifyViewport(ev.viewport);
    let success = false;

    switch (this.toolModel.currentState) {
      case MeasureRadiusToolModel.State.SetMeasurementViewport: {
        success = this.toolModel.setMeasurementViewport(viewType);
        if (success)
          success = this.toolModel.setStartPoint(viewType, ev.point, false);
        break;
      }
      case MeasureRadiusToolModel.State.SetMidPoint: {
        success = this.toolModel.setMidPoint(viewType, ev.point, false);
        break;
      }
      case MeasureRadiusToolModel.State.SetEndPoint: {
        success = this.toolModel.setEndPoint(viewType, ev.point, false);
        break;
      }
    }

    if (success) this.updateToolAssistance();

    ev.viewport.invalidateDecorations();
    return EventHandled.Yes;
  }
}
