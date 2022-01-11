/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { GeoServiceStatus } from "@itwin/core-bentley";
import { CurvePrimitive, GeometryQuery, IModelJson, Vector3d } from "@itwin/core-geometry";
import { IModelError, SnapRequestProps } from "@itwin/core-common";
import {
  BeButtonEvent, EventHandled, IModelApp, LocateResponse, OutputMessagePriority, SnapDetail, SnapMode, SnapStatus, ToolAssistance,
  ToolAssistanceImage, ToolAssistanceInputMethod, ToolAssistanceInstruction, ToolAssistanceSection,
} from "@itwin/core-frontend";
import { Feature, MeasureToolsFeatures } from "../api/FeatureTracking";
import { MeasurementToolBase } from "../api/MeasurementTool";
import { MeasurementViewTarget } from "../api/MeasurementViewTarget";
import { LocationMeasurement } from "../measurements/LocationMeasurement";
import { AddLocationProps, MeasureLocationToolModel } from "../toolmodels/MeasureLocationToolModel";

/** Tool that measure precise locations */
export class MeasureLocationTool extends MeasurementToolBase<LocationMeasurement, MeasureLocationToolModel> {

  public static override toolId = "MeasureLocation";
  public static override iconSpec = "icon-measure-location";

  protected override get feature(): Feature | undefined { return MeasureToolsFeatures.Tools_MeasureLocation; }

  constructor() {
    super();
  }

  public async onRestartTool(): Promise<void> {
    const tool = new MeasureLocationTool();
    if (await tool.run())
      return;

    return this.exitTool();
  }

  public override async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (!ev.viewport)
      return EventHandled.No;

    const props: AddLocationProps = {
      location: ev.point.clone(),
      viewType: MeasurementViewTarget.classifyViewport(ev.viewport),
    };

    await this._queryGeoLocation(props);

    // Perform a snap to get more information (such as the surface normal, if any)
    const snap = await this.requestSnap(ev);
    if (undefined !== snap && undefined !== snap.normal)
      props.slope = this.getSlopeFromNormal(snap.normal);

    this.toolModel.addLocation(props);
    this.updateToolAssistance();
    return EventHandled.Yes;
  }

  protected createToolModel(): MeasureLocationToolModel {
    return new MeasureLocationToolModel();
  }

  protected async requestSnap(ev: BeButtonEvent): Promise<SnapDetail | undefined> {

    let hit = IModelApp.accuSnap.currHit;
    if (undefined === hit)
      hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);

    if (undefined === hit)
      return undefined;

    // Already a snap
    if (hit instanceof SnapDetail)
      return hit;

    // Pretty much copied off AccuSnap.ts
    const requestProps: SnapRequestProps = {
      id: hit.sourceId,
      testPoint: hit.testPoint,
      closePoint: hit.hitPoint,
      worldToView: hit.viewport.worldToViewMap.transform0.toJSON(),
      viewFlags: hit.viewport.viewFlags,
      snapModes: [SnapMode.Nearest],
      snapAperture: hit.viewport.pixelsFromInches(0.1),
    };

    const result = await this.iModel.requestSnap(requestProps);
    if (result.status !== SnapStatus.Success)
      return undefined;

    const parseCurve = (json: any): CurvePrimitive | undefined => {
      const parsed = undefined !== json ? IModelJson.Reader.parse(json) : undefined;
      return parsed instanceof GeometryQuery && "curvePrimitive" === parsed.geometryCategory ? parsed : undefined;
    };

    const snap = new SnapDetail(hit, result.snapMode, result.heat, result.snapPoint);
    snap.setCurvePrimitive(parseCurve(result.curve), undefined, result.geomType);
    if (undefined !== result.parentGeomType)
      snap.parentGeomType = result.parentGeomType;
    if (undefined !== result.hitPoint)
      snap.hitPoint.setFromJSON(result.hitPoint); // Update hitPoint from readPixels with exact point location corrected to surface/edge geometry...
    if (undefined !== result.normal)
      snap.normal = Vector3d.fromJSON(result.normal);

    // Final check to make sure we've got the information from the right place
    if (!ev.point.isAlmostEqual(snap.hitPoint))
      return undefined;

    return snap;
  }

  private async _queryGeoLocation(props: AddLocationProps): Promise<void> {

    let message = "";
    let priority: OutputMessagePriority;

    try {
      props.geoLocation = await this.iModel.spatialToCartographic(props.location);
    } catch (error) {
      // Probably not an error we should handle gracefully
      if (!(error instanceof IModelError))
        throw error;

      switch (error.errorNumber) {
        case GeoServiceStatus.NoGeoLocation:
          message = IModelApp.localization.getLocalizedString("MeasureTools:tools.MeasureLocation.iModelNotGeoLocated");
          priority = OutputMessagePriority.Info;
          break;
        case GeoServiceStatus.OutOfMathematicalDomain:
        case GeoServiceStatus.OutOfUsefulRange:
          message = IModelApp.localization.getLocalizedString("MeasureTools:tools.MeasureLocation.locationOutOfGCSRange");
          priority = OutputMessagePriority.Warning;
          break;
        default:
          message = IModelApp.localization.getLocalizedString("MeasureTools:tools.MeasureLocation.unhandledGeoLocationError");
          priority = OutputMessagePriority.Error;
      }
    }

    if (0 < message.length)
      this.showMessage(priority!, message);
  }

  private getSlopeFromNormal(normal: Vector3d): number | undefined {
    if (0.0 !== normal.z)
      return normal.magnitudeXY() / normal.z;

    return undefined;
  }

  protected override updateToolAssistance(): void {
    const promptMainInstruction = IModelApp.localization.getLocalizedString("MeasureTools:tools.MeasureLocation.mainInstruction");
    const promptClickTap = IModelApp.localization.getLocalizedString("MeasureTools:tools.GenericPrompts.acceptPoint");
    const promptRightClick = IModelApp.localization.getLocalizedString("MeasureTools:tools.GenericPrompts.restart");

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
