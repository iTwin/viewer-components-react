/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { GeoServiceStatus } from "@itwin/core-bentley";
import type { CurvePrimitive } from "@itwin/core-geometry";
import { GeometryQuery, IModelJson, Vector3d } from "@itwin/core-geometry";
import { IModelError } from "@itwin/core-common";
import type {
  BeButtonEvent,
  ToolAssistanceInstruction,
  ToolAssistanceSection,
} from "@itwin/core-frontend";
import {
  EventHandled,
  IModelApp,
  LocateResponse,
  OutputMessagePriority,
  SnapDetail,
  ToolAssistance,
  ToolAssistanceImage,
  ToolAssistanceInputMethod,
} from "@itwin/core-frontend";
import type { Feature } from "../api/FeatureTracking";
import { MeasureToolsFeatures } from "../api/FeatureTracking";
import { MeasurementToolBase } from "../api/MeasurementTool";
import { MeasurementViewTarget } from "../api/MeasurementViewTarget";
import type { LocationMeasurement } from "../measurements/LocationMeasurement";
import type { AddLocationProps } from "../toolmodels/MeasureLocationToolModel";
import { MeasureLocationToolModel } from "../toolmodels/MeasureLocationToolModel";
import { MeasureTools } from "../MeasureTools";
import type { DialogItem, DialogItemValue, DialogPropertySyncItem } from "@itwin/appui-abstract";
import { PropertyDescriptionHelper } from "@itwin/appui-abstract";
import { SheetMeasurementsHelper } from "../api/SheetMeasurementHelper";
import type { DrawingMetadata, DrawingMetadataProps } from "../api/Measurement";
import { DrawingDataCache } from "../measure-tools-react";

/** Tool that measure precise locations */
export class MeasureLocationTool extends MeasurementToolBase<
LocationMeasurement,
MeasureLocationToolModel
> {
  public static override toolId = "MeasureTools.MeasureLocation";
  public static override iconSpec = "icon-measure-location";
  private static readonly useDynamicMeasurementPropertyName = "useDynamicMeasurement";
  private _enableSheetMeasurements: boolean;

  private static _isUserNotifiedOfGeolocationFailure = false;
  private _useDynamicMeasurement: boolean = false;

  public static override get flyover() {
    return MeasureTools.localization.getLocalizedString(
      "MeasureTools:tools.MeasureLocation.flyover"
    );
  }
  public static override get description(): string {
    return MeasureTools.localization.getLocalizedString(
      "MeasureTools:tools.MeasureLocation.description",
    );
  }
  public static override get keyin(): string {
    return MeasureTools.localization.getLocalizedString(
      "MeasureTools:tools.MeasureLocation.keyin",
    );
  }

  protected override get feature(): Feature | undefined {
    return MeasureToolsFeatures.Tools_MeasureLocation;
  }

  constructor(enableSheetMeasurements = false) {
    super();
    this._enableSheetMeasurements = enableSheetMeasurements;
  }

  public async onRestartTool(): Promise<void> {
    const tool = new MeasureLocationTool(this._enableSheetMeasurements);
    if (await tool.run()) return;

    return this.exitTool();
  }

  public override async onPostInstall(): Promise<void> {
    await super.onPostInstall();
  }

  public override async onDataButtonDown(
    ev: BeButtonEvent
  ): Promise<EventHandled> {
    if (!ev.viewport) return EventHandled.No;

    const props = await this.createLocationProps(ev, true);
    this.toolModel.addLocation(props, false);
    this.updateToolAssistance();
    return EventHandled.Yes;
  }

  private async sheetMeasurementsDataButtonDown(ev: BeButtonEvent): Promise<DrawingMetadata | undefined> {
    if (!ev.viewport) return undefined;

    if (this._enableSheetMeasurements) {
      if (ev.viewport.view.id !== undefined) {
        const drawingInfo = await SheetMeasurementsHelper.getDrawingId(this.iModel, ev.viewport.view.id, ev.point);

        if (drawingInfo?.drawingId !== undefined && drawingInfo.origin !== undefined && drawingInfo.worldScale !== undefined) {
          const data: DrawingMetadata = { origin: drawingInfo.origin, drawingId: drawingInfo.drawingId, worldScale: drawingInfo.worldScale, extents: drawingInfo.extents, sheetToWorldTransform: drawingInfo.sheetToWorldTransform};
          return data;
        }
      }
    }
    return undefined;
  }

  public override async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    if (undefined === ev.viewport || !this._useDynamicMeasurement)
      return;

    const props = await this.createLocationProps(ev, false);
    this.toolModel.addLocation(props, true);
    ev.viewport.invalidateDecorations();
  }

  private async createLocationProps(ev: BeButtonEvent, requestSnap: boolean): Promise<AddLocationProps> {
    const props: AddLocationProps = {
      location: ev.point.clone(),
      viewType: MeasurementViewTarget.classifyViewport(ev.viewport!),
      viewId: ev.viewport?.view.id,
      drawingMetadata: (await this.sheetMeasurementsDataButtonDown(ev)) as DrawingMetadataProps,
    };

    await this.queryGeoLocation(props);

    // Perform a snap to get more information (such as the surface normal, if any)
    // Does not look for new snap point if already looking from past frame
    let snap = IModelApp.accuSnap.getCurrSnapDetail();
    if (!snap && requestSnap)
      snap = await this.requestSnap(ev);

    if (snap?.normal)
      props.slope = this.getSlopeFromNormal(snap.normal);

    return props;
  }

  protected createToolModel(): MeasureLocationToolModel {
    return new MeasureLocationToolModel();
  }

  public override isValidLocation(ev: BeButtonEvent, _isButtonEvent: boolean): boolean {
    if (!this._enableSheetMeasurements)
      return true;

    if (true !== ev.viewport?.view.isSheetView()) {
      return true;
    }

    for (const drawing of DrawingDataCache.getInstance().getSheetDrawingDataForViewport(ev.viewport)) {
      if (SheetMeasurementsHelper.checkIfInDrawing(ev.point, drawing.origin, drawing.extents)) {
        if (drawing.type !== SheetMeasurementsHelper.DrawingType.CrossSection && drawing.type !== SheetMeasurementsHelper.DrawingType.Plan) {
          return false;
        }
      }
    }

    return true;
  }

  protected async requestSnap(
    ev: BeButtonEvent
  ): Promise<SnapDetail | undefined> {
    let hit = IModelApp.accuSnap.currHit;
    if (undefined === hit)
      hit = await IModelApp.locateManager.doLocate(
        new LocateResponse(),
        true,
        ev.point,
        ev.viewport,
        ev.inputSource
      );

    if (undefined === hit) return undefined;

    // Already a snap
    if (hit instanceof SnapDetail) return hit;

    const result = await IModelApp.accuSnap.doSnapRequest(hit);
    if (undefined === result) return undefined;

    const snap = new SnapDetail(
      hit,
      result.snapMode,
      result.heat,
      result.snapPoint
    );
    snap.setCurvePrimitive(
      result.primitive,
      undefined,
      result.geomType
    );
    if (undefined !== result.parentGeomType)
      snap.parentGeomType = result.parentGeomType;
    if (undefined !== result.hitPoint)
      snap.hitPoint.setFromJSON(result.hitPoint); // Update hitPoint from readPixels with exact point location corrected to surface/edge geometry...
    if (undefined !== result.normal)
      snap.normal = Vector3d.fromJSON(result.normal);

    // Final check to make sure we've got the information from the right place
    if (!ev.point.isAlmostEqual(snap.hitPoint)) return undefined;

    return snap;
  }

  /** Update the props to add GeoLocation information when available */
  private async queryGeoLocation(props: AddLocationProps): Promise<void> {
    let message = "";
    let priority: OutputMessagePriority | undefined;

    if (!this.iModel.isGeoLocated) {
      if (MeasureLocationTool._isUserNotifiedOfGeolocationFailure)
        return;

      // Only notify user once
      MeasureLocationTool._isUserNotifiedOfGeolocationFailure = true;
    }

    try {
      props.geoLocation = await this.iModel.spatialToCartographic(
        props.location
      );
    } catch (error) {
      // Probably not an error we should handle gracefully
      if (!(error instanceof IModelError)) throw error;

      switch (error.errorNumber) {
        case GeoServiceStatus.NoGeoLocation:
          message = MeasureTools.localization.getLocalizedString(
            "MeasureTools:tools.MeasureLocation.iModelNotGeoLocated"
          );
          priority = OutputMessagePriority.Info;
          break;
        case GeoServiceStatus.OutOfMathematicalDomain:
        case GeoServiceStatus.OutOfUsefulRange:
          message = MeasureTools.localization.getLocalizedString(
            "MeasureTools:tools.MeasureLocation.locationOutOfGCSRange"
          );
          priority = OutputMessagePriority.Warning;
          break;
        default:
          message = MeasureTools.localization.getLocalizedString(
            "MeasureTools:tools.MeasureLocation.unhandledGeoLocationError"
          );
          priority = OutputMessagePriority.Error;
      }
    }

    if (0 < message.length && undefined !== priority)
      this.showMessage(priority, message);
  }

  private getSlopeFromNormal(normal: Vector3d): number | undefined {
    if (0.0 !== normal.z) return normal.magnitudeXY() / normal.z;

    return undefined;
  }

  protected override updateToolAssistance(): void {
    const promptMainInstruction = MeasureTools.localization.getLocalizedString(
      "MeasureTools:tools.MeasureLocation.mainInstruction"
    );
    const promptClickTap = MeasureTools.localization.getLocalizedString(
      "MeasureTools:tools.GenericPrompts.acceptPoint"
    );
    const promptRightClick = MeasureTools.localization.getLocalizedString(
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

  public override async onInstall(): Promise<boolean> {
    if (!await super.onInstall())
      return false;

    const initialValue = IModelApp.toolAdmin.toolSettingsState.getInitialToolSettingValue(this.toolId, MeasureLocationTool.useDynamicMeasurementPropertyName);
    if (initialValue)
      this._useDynamicMeasurement = typeof initialValue.value === "boolean" ? initialValue.value : false;

    return true;
  }

  public override async onCleanup(): Promise<void> {
    const propertyName = MeasureLocationTool.useDynamicMeasurementPropertyName;
    const value: DialogItemValue = { value: this._useDynamicMeasurement };
    IModelApp.toolAdmin.toolSettingsState.saveToolSettingProperty(this.toolId, { propertyName, value });

    return super.onCleanup();
  }

  public override supplyToolSettingsProperties(): DialogItem[] {
    const toolSettings: DialogItem[] = [];

    const propertyLabel = MeasureTools.localization.getLocalizedString(
      "MeasureTools:tools.MeasureLocation.useDynamicMeasurement"
    );
    toolSettings.push({
      value: { value: this._useDynamicMeasurement },
      property: PropertyDescriptionHelper.buildToggleDescription(MeasureLocationTool.useDynamicMeasurementPropertyName, propertyLabel),
      editorPosition: { rowPriority: 0, columnIndex: 0 },
      isDisabled: false,
    });

    return toolSettings;
  }

  public override async applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): Promise<boolean> {
    if (MeasureLocationTool.useDynamicMeasurementPropertyName === updatedValue.propertyName) {
      const value = updatedValue.value.value;
      if (typeof value !== "boolean")
        return false;

      this._useDynamicMeasurement = value;
      if (!this._useDynamicMeasurement)
        this.toolModel.reset(false);
      return true;
    }

    return super.applyToolSettingPropertyChange(updatedValue);
  }

}
