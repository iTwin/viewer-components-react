/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Vector3d } from "@itwin/core-geometry";
import { Plane3dByOriginAndUnitNormal, Point3d, Ray3d } from "@itwin/core-geometry";
import type {
  BeButtonEvent,
  ToolAssistanceInstruction, ToolAssistanceSection,
} from "@itwin/core-frontend";
import {
  EventHandled, IModelApp, OutputMessagePriority, TentativeOrAccuSnap, ToolAssistance, ToolAssistanceImage, ToolAssistanceInputMethod,
} from "@itwin/core-frontend";
import type { Feature } from "../api/FeatureTracking";
import { MeasureToolsFeatures } from "../api/FeatureTracking";
import { MeasurementToolBase } from "../api/MeasurementTool";
import { MeasurementViewTarget } from "../api/MeasurementViewTarget";
import type { DistanceMeasurement } from "../measurements/DistanceMeasurement";
import { MeasureDistanceToolModel } from "../toolmodels/MeasureDistanceToolModel";

export class MeasurePerpendicularTool extends MeasurementToolBase<DistanceMeasurement, MeasureDistanceToolModel> {
  public static override toolId = "MeasurePerpendicular";
  public static override iconSpec = "icon-measure-perpendicular";

  protected _firstSurface?: Plane3dByOriginAndUnitNormal;
  protected override get feature(): Feature | undefined { return MeasureToolsFeatures.Tools_MeasurePerpendicular; }

  public async onRestartTool(): Promise<void> {
    const tool = new MeasurePerpendicularTool();
    if (await tool.run())
      return;

    return this.exitTool();
  }

  private _computePlanePoint(origin: Point3d, normal: Vector3d): Point3d | undefined {
    if (undefined === this._firstSurface)
      return undefined;

    const ray = Ray3d.create(origin, normal);
    const result = Point3d.create();

    return (undefined !== ray.intersectionWithPlane(this._firstSurface, result) ? result : undefined);
  }

  public override async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (!ev.viewport)
      return EventHandled.No;

    const snap = TentativeOrAccuSnap.getCurrentSnap(false);
    if (undefined === snap || undefined === snap.normal) {
      const message = IModelApp.localization.getLocalizedString("MeasureTools:tools.MeasurePerpendicular.identifySurface");
      this.showMessage(OutputMessagePriority.Info, message);
      return EventHandled.No;
    }

    if (MeasureDistanceToolModel.State.SetMeasurementViewport === this.toolModel.currentState) {
      const viewType = MeasurementViewTarget.classifyViewport(ev.viewport);
      this._firstSurface = Plane3dByOriginAndUnitNormal.create(snap.snapPoint, snap.normal);
      this.toolModel.setMeasurementViewport(viewType);
      this.toolModel.setStartPoint(viewType, ev.point);
      this.updateToolAssistance();
    } else if (MeasureDistanceToolModel.State.SetEndPoint === this.toolModel.currentState) {
      const current = this.toolModel.dynamicMeasurement;
      if (undefined === current)
        return EventHandled.No;

      const perpPt = this._computePlanePoint(ev.point, snap.normal);
      if (undefined === perpPt)
        return EventHandled.No;

      const viewType = MeasurementViewTarget.classifyViewport(ev.viewport);
      current.startPointRef.setFrom(ev.point);
      this.toolModel.setEndPoint(viewType, perpPt, false);
      await this.onReinitialize();
    }

    ev.viewport.invalidateDecorations();
    return EventHandled.Yes;
  }

  public override async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    if (undefined === ev.viewport || MeasureDistanceToolModel.State.SetEndPoint !== this.toolModel.currentState)
      return;

    const current = this.toolModel.dynamicMeasurement;
    if (undefined === current)
      return;

    const snap = TentativeOrAccuSnap.getCurrentSnap(false);
    if (undefined === snap || undefined === snap.normal)
      return;

    const perpPt = this._computePlanePoint(ev.point, snap.normal);
    if (undefined === perpPt)
      return;

    const viewType = MeasurementViewTarget.classifyViewport(ev.viewport);
    current.startPointRef.setFrom(ev.point);
    this.toolModel.setEndPoint(viewType, perpPt, true);
    ev.viewport.invalidateDecorations();
  }

  protected createToolModel(): MeasureDistanceToolModel {
    return new MeasureDistanceToolModel();
  }

  protected override updateToolAssistance(): void {
    let promptMainInstruction: string;
    if (MeasureDistanceToolModel.State.SetEndPoint !== this.toolModel.currentState)
      promptMainInstruction = IModelApp.localization.getLocalizedString("MeasureTools:tools.MeasurePerpendicular.mainInstruction");
    else
      promptMainInstruction = IModelApp.localization.getLocalizedString("MeasureTools:tools.MeasurePerpendicular.mainInstruction2");

    const promptClickTap = IModelApp.localization.getLocalizedString("MeasureTools:tools.GenericPrompts.acceptPoint");

    let promptRightClick: string;
    if (undefined !== this.toolModel.dynamicMeasurement)
      promptRightClick = IModelApp.localization.getLocalizedString("MeasureTools:tools.GenericPrompts.clearCurrentMeasurement");
    else
      promptRightClick = IModelApp.localization.getLocalizedString("MeasureTools:tools.GenericPrompts.restart");

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
