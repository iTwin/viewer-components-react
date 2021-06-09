/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BeButtonEvent, EventHandled, IModelApp, OutputMessagePriority, TentativeOrAccuSnap, ToolAssistance, ToolAssistanceInstruction, ToolAssistanceImage, ToolAssistanceSection, ToolAssistanceInputMethod } from "@bentley/imodeljs-frontend";
import { Plane3dByOriginAndUnitNormal, Point3d, Ray3d, Vector3d } from "@bentley/geometry-core";
import { MeasureDistanceToolModel } from "../toolmodels/MeasureDistanceToolModel";
import { MeasurementToolBase } from "../api/MeasurementTool";
import { MeasurementViewTarget } from "../api/MeasurementViewTarget";
import { DistanceMeasurement } from "../measurements/DistanceMeasurement";
import { Feature, MeasureToolsFeatures } from "../api/FeatureTracking";

export class MeasurePerpendicularTool extends MeasurementToolBase<DistanceMeasurement, MeasureDistanceToolModel> {
  public static toolId = "MeasurePerpendicular";
  public static iconSpec = "icon-measure-perpendicular";

  protected _firstSurface?: Plane3dByOriginAndUnitNormal;
  protected get feature(): Feature | undefined { return MeasureToolsFeatures.Tools_MeasurePerpendicular; }

  public onRestartTool(): void {
    const tool = new MeasurePerpendicularTool();
    if (!tool.run())
      this.exitTool();
  }

  private _computePlanePoint(origin: Point3d, normal: Vector3d): Point3d | undefined {
    if (undefined === this._firstSurface)
      return undefined;

    const ray = Ray3d.create(origin, normal);
    const result = Point3d.create();

    return (undefined !== ray.intersectionWithPlane(this._firstSurface, result) ? result : undefined);
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (!ev.viewport)
      return EventHandled.No;

    const snap = TentativeOrAccuSnap.getCurrentSnap(false);
    if (undefined === snap || undefined === snap.normal) {
      const message = IModelApp.i18n.translate("MeasureTools:tools.MeasurePerpendicular.identifySurface");
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
      this.onReinitialize();
    }

    ev.viewport.invalidateDecorations();
    return EventHandled.Yes;
  }

  public async onMouseMotion(ev: BeButtonEvent): Promise<void> {
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

  protected updateToolAssistance(): void {
    let promptMainInstruction: string;
    if (MeasureDistanceToolModel.State.SetEndPoint !== this.toolModel.currentState)
      promptMainInstruction = IModelApp.i18n.translate("MeasureTools:tools.MeasurePerpendicular.mainInstruction");
    else
      promptMainInstruction = IModelApp.i18n.translate("MeasureTools:tools.MeasurePerpendicular.mainInstruction2");

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
