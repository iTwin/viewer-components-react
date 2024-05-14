/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type {
  BeButtonEvent,
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

export class MeasureDistanceTool extends MeasurementToolBase<
DistanceMeasurement,
MeasureDistanceToolModel
> {
  public static override toolId = "MeasureTools.MeasureDistance";
  public static override iconSpec = "icon-measure-distance";

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

  constructor() {
    super();
  }

  public async onRestartTool(): Promise<void> {
    const tool = new MeasureDistanceTool();
    if (await tool.run()) return;

    return this.exitTool();
  }

  public override async onReinitialize(): Promise<void> {
    await super.onReinitialize();
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

      if (ev.viewport.view.id !== undefined) {
        this.toolModel.firstPointDrawingId = await SheetMeasurementsHelper.getDrawingId(this.iModel, ev.viewport.view.id, ev.point);
        if (this.toolModel.firstPointDrawingId)
          this.toolModel.setRatio(await SheetMeasurementsHelper.getRatio(this.iModel, this.toolModel.firstPointDrawingId));
      }

      this._sendHintsToAccuDraw(ev);
      this.updateToolAssistance();
    } else if (
      MeasureDistanceToolModel.State.SetEndPoint === this.toolModel.currentState
    ) {
      if (await SheetMeasurementsHelper.getDrawingId(this.iModel, ev.viewport.view.id, ev.point) === this.toolModel.firstPointDrawingId && this.toolModel.firstPointDrawingId !== undefined) {
        this.toolModel.setRatio(await SheetMeasurementsHelper.getRatio(this.iModel, this.toolModel.firstPointDrawingId));
      } else {
        this.toolModel.setRatio(undefined);
      }
      this.toolModel.setEndPoint(viewType, ev.point, false);
      await this.onReinitialize();
    }

    ev.viewport.invalidateDecorations();
    return EventHandled.Yes;
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
