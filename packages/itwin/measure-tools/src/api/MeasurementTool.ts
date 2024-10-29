/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Id64String } from "@itwin/core-bentley";
import { BeDuration, BeUiEvent } from "@itwin/core-bentley";
import type { GeometryStreamProps } from "@itwin/core-common";
import type {
  BeButtonEvent,
  DecorateContext,
  HitDetail,
  IModelConnection,
  ToolAssistanceInstruction,
} from "@itwin/core-frontend";
import {
  EventHandled,
  IModelApp,
  NotifyMessageDetails,
  OutputMessageAlert,
  OutputMessagePriority,
  OutputMessageType,
  PrimitiveTool,
  ToolAssistance,
  ToolAssistanceInputMethod,
} from "@itwin/core-frontend";
import { MeasureTools } from "../MeasureTools";
import type { Feature } from "./FeatureTracking";
import { FeatureTracking } from "./FeatureTracking";
import type { Measurement } from "./Measurement";
import type { MeasurementToolModel } from "./MeasurementToolModel";
import { SheetMeasurementsHelper } from "./SheetMeasurementHelper";

/** Interface for any interactive tool that creates measurements. */
export interface MeasurementTool {
  /** Gets a read-only list of measurements active in the tool. Note: By convention all measurements can be found in the [[MeasurementManager]] so it is unnecessary to query the current measurement
   * tool if interested in querying all measurements.
   */
  readonly measurements: ReadonlyArray<Measurement>;

  /** Gets the current measurement the user is placing. */
  readonly dynamicMeasurement: Measurement | undefined;

  /** Persists the measurements that are active in the tool. Ownership of the measurements transfer to the measurement manager. If the tool does not persist, the
   * measurements it has created are deleted from the [[MeasurementManager]].
   * @returns true if measurements were persisted, false otherwise.
   */
  persistMeasurements(): boolean;

  /** Clears any active measurements in the [[MeasurementManager]] that the tool owns.
   * @param viewType Optionally clear measurements based on the type of viewport they're drawn in.
   */
  clearMeasurements(viewType?: string): void;
}

/** Namespace for functions relating to the MeasurementTool interface. */
export namespace MeasurementTool {
  /** Event for when a tool creates a new measurement. */
  export const onNewMeasurement = new BeUiEvent<Measurement>();

  /** Event when the tool's dynamic measurement has changed. */
  export const onDynamicMeasurementChanged = new BeUiEvent<Measurement>();

  /** Gets the active measurement tool, if it exists.
   * @returns the measurement tool, or undefined if the current tool is not one.
   */
  export function getActiveMeasurementTool(): MeasurementTool | undefined {
    const tool = IModelApp.toolAdmin.currentTool;
    if (
      tool === undefined ||
      !("measurements" in tool) ||
      !("persistMeasurements" in tool) ||
      !("clearMeasurements" in tool)
    )
      return undefined;

    return tool as unknown as MeasurementTool;
  }
}

/**
 * Helper class to hold the selection state during the operation of a tool. Call saveSelection on install and restoreSelection on cleanup.
 */
export class SelectionHolder {
  private _imodel?: IModelConnection;
  private _selectedIds: Set<Id64String>;

  constructor() {
    this._selectedIds = new Set<Id64String>();
  }

  public saveSelection(
    imodel: IModelConnection,
    clearSelectionAfter: boolean
  ): void {
    this._imodel = imodel;
    this._selectedIds.clear();
    imodel.selectionSet.elements.forEach((id) => this._selectedIds.add(id));

    if (clearSelectionAfter) imodel.selectionSet.emptyAll();
  }

  public restoreSelection(): void {
    if (!this._imodel) return;

    this._imodel.selectionSet.replace(this._selectedIds);
    this._imodel = undefined;
    this._selectedIds.clear();
  }
}

/** Useful base class for tools */
export abstract class PrimitiveToolBase extends PrimitiveTool {
  protected get feature(): Feature | undefined {
    return undefined;
  }

  public override async onPostInstall(): Promise<void> {
    await super.onPostInstall();

    const feature = this.feature;
    if (feature) FeatureTracking.notifyFeature(feature);
  }

  // Recommended way to show feedback to the user in a consistant manor
  protected showMessage(
    priority: OutputMessagePriority,
    briefMessage: string | HTMLElement,
    detailedMessage?: string | HTMLElement
  ) {
    const msg = new NotifyMessageDetails(
      priority,
      briefMessage,
      detailedMessage,
      OutputMessageType.Toast,
      OutputMessageAlert.Balloon
    );
    msg.displayTime = BeDuration.fromSeconds(5.0);
    IModelApp.notifications.outputMessage(msg);
  }

  protected async showException(err: Error) {
    const priority = OutputMessagePriority.Error;
    const msg = err.message || err.name || typeof err;

    this.showMessage(priority, msg);
  }

  protected createMouseUndoInstruction(
    textOverride?: string
  ): ToolAssistanceInstruction {
    const text =
      textOverride ||
      MeasureTools.localization.getLocalizedString(
        "MeasureTools:Generic.undoMeasurement"
      );
    return ToolAssistance.createKeyboardInstruction(
      ToolAssistance.createKeyboardInfo([ToolAssistance.ctrlKey, "Z"]),
      text,
      false,
      ToolAssistanceInputMethod.Mouse
    );
  }

  protected createMouseRedoInstruction(
    textOverride?: string
  ): ToolAssistanceInstruction {
    const text =
      textOverride ||
      MeasureTools.localization.getLocalizedString(
        "MeasureTools:Generic.redoMeasurement"
      );
    return ToolAssistance.createKeyboardInstruction(
      ToolAssistance.createKeyboardInfo([ToolAssistance.ctrlKey, "Y"]),
      text,
      false,
      ToolAssistanceInputMethod.Mouse
    );
  }

  // For most of our cases we expect to draw our decorations when suspended also
  public override decorateSuspended(context: DecorateContext): void {
    this.decorate(context);
  }
}

/** Useful base class for measurement tools which maintains a tool model that a subclass will instantiate as well as save the current selection/restore on exit.
 * Generally a measurement tool model contains all the logic to create and manage measurements dynamically, while the tool is responsible
 * for sending input events to the model.
 */
export abstract class MeasurementToolBase<
  T extends Measurement,
  ToolModel extends MeasurementToolModel<T>
>
  extends PrimitiveToolBase
  implements MeasurementTool {
  private _toolModel: ToolModel;
  private _selectionHolder: SelectionHolder;

  protected _enableSheetMeasurements: boolean;

  public get measurements(): ReadonlyArray<Measurement> {
    return this._toolModel.measurements;
  }

  public get dynamicMeasurement(): Measurement | undefined {
    return this._toolModel.dynamicMeasurement;
  }

  protected get toolModel(): ToolModel {
    return this._toolModel;
  }

  protected get selectionHolder(): SelectionHolder {
    return this._selectionHolder;
  }

  protected get saveRestoreSelection(): boolean {
    return true;
  }

  protected get allowedDrawingTypes(): SheetMeasurementsHelper.DrawingType[] {
    return [];
  }

  constructor() {
    super();

    this._enableSheetMeasurements = false;
    this._toolModel = this.createToolModel();
    this._toolModel.synchMeasurementsWithSelectionSet = true; // Sync by default
    this._selectionHolder = new SelectionHolder();
    this.setupEvents();
  }

  public override requireWriteableTarget(): boolean {
    return false;
  }

  public override isValidLocation(
    _ev: BeButtonEvent,
    _isButtonEvent: boolean
  ): boolean {
    // In most cases, the location will be okay even if outside the model extents
    return true;
  }

  public override async onPostInstall(): Promise<void> {
    await super.onPostInstall();

    if (this.saveRestoreSelection)
      this._selectionHolder.saveSelection(this.iModel, true);

    this._toolModel.initialize();
    this.updateAccuSnap();
    this.updateToolAssistance();
  }

  public override async onCleanup(): Promise<void> {
    await super.onCleanup();

    if (this.saveRestoreSelection) this._selectionHolder.restoreSelection();

    // Persist measurements when the tool exits
    this._toolModel.persistMeasurements();
    this._toolModel.cleanup();
  }

  public override async onReinitialize(): Promise<void> {
    this.toolModel.reset(false);
    this.updateAccuSnap();
    this.updateToolAssistance();
  }

  public override async onUndoPreviousStep(): Promise<boolean> {
    // If we have an active measurement, reset to initial state
    if (undefined !== this._toolModel.dynamicMeasurement) {
      await this.onReinitialize();
      return true;
    }

    // Start undoing existing measurements
    if (this._toolModel.canUndo) {
      const result = this._toolModel.undoMeasurement();
      this.updateToolAssistance();
      return result;
    }

    const message = MeasureTools.localization.getLocalizedString(
      "MeasureTools:Generic.nothingToUndo"
    );
    this.showMessage(OutputMessagePriority.Info, message);
    return false;
  }

  public override async onRedoPreviousStep(): Promise<boolean> {
    // Probably not a good idea if there are ongoing measurements
    if (undefined !== this._toolModel.dynamicMeasurement) return false;

    if (this._toolModel.canRedo) {
      const result = this._toolModel.redoMeasurement();
      this.updateToolAssistance();
      return result;
    }

    const message = MeasureTools.localization.getLocalizedString(
      "MeasureTools:Generic.nothingToRedo"
    );
    this.showMessage(OutputMessagePriority.Info, message);
    return false;
  }

  public override async onResetButtonDown(
    _ev: BeButtonEvent
  ): Promise<EventHandled> {
    if (undefined !== this.toolModel.dynamicMeasurement)
      await this.onReinitialize();
    else await this.onRestartTool();

    return EventHandled.Yes;
  }

  public override async onKeyTransition(
    wentDown: boolean,
    keyEvent: KeyboardEvent
  ): Promise<EventHandled> {
    if (EventHandled.Yes === (await super.onKeyTransition(wentDown, keyEvent)))
      return EventHandled.Yes;

    if (wentDown && "escape" === keyEvent.key.toLowerCase()) {
      await this.exitTool();
      return EventHandled.Yes;
    }

    return EventHandled.No;
  }

  public override testDecorationHit(id: string): boolean {
    return this._toolModel.testDecorationHit(id);
  }

  public override getDecorationGeometry(
    hit: HitDetail
  ): GeometryStreamProps | undefined {
    return this._toolModel.getDecorationGeometry(hit);
  }

  public override async getToolTip(hit: HitDetail): Promise<HTMLElement | string> {
    const defaultToolTip = async (hit: HitDetail) => {
      const toolTip = await this._toolModel.getToolTip(hit);

      if (toolTip === "") return super.getToolTip(hit);

      return toolTip;
    }
    if (!this._enableSheetMeasurements) {
      return defaultToolTip(hit);
    } else {
      return SheetMeasurementsHelper.getSheetErrorToolTipText(hit, this.allowedDrawingTypes, defaultToolTip);
    }
  }

  public override decorate(context: DecorateContext): void {
    this._toolModel.decorate(context);
  }

  public override async onUnsuspend(): Promise<void> {
    this.updateAccuSnap();
    this.updateToolAssistance();
  }

  public persistMeasurements(): boolean {
    return this._toolModel.persistMeasurements();
  }

  public clearMeasurements(viewportType?: string): void {
    this._toolModel.clearMeasurements(viewportType);
  }

  protected updateAccuSnap() {
    IModelApp.accuSnap.enableSnap(true);
  }

  protected updateToolAssistance() {}

  protected abstract createToolModel(): ToolModel;

  protected setupEvents() {
    this._toolModel.onNewMeasurement.addListener((args: Measurement) => {
      MeasurementTool.onNewMeasurement.emit(args);
    });

    this._toolModel.onDynamicMeasurementChanged.addListener(
      (args: Measurement) => {
        MeasurementTool.onDynamicMeasurementChanged.emit(args);
      }
    );
  }
}
