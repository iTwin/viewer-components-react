/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { DecorateContext, HitDetail } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import type { GeometryStreamProps } from "@itwin/core-common";
import { BeUiEvent } from "@itwin/core-bentley";
import type { Measurement } from "./Measurement.js";
import { MeasurementPickContext } from "./Measurement.js";
import { MeasurementSelectionSet } from "./MeasurementSelectionSet.js";
import { MeasurementSyncUiEventId, WellKnownViewType } from "./MeasurementEnums.js";
import { MeasurementManager } from "./MeasurementManager.js";
import { SyncUiEventDispatcher } from "@itwin/appui-react";

class Stack<T> {
  private _data: T[] = [];

  constructor() { }

  public get isEmpty(): boolean { return 0 === this._data.length; }
  public size(): number { return this._data.length; }
  public push(m: T): number { return this._data.push(m); }
  public pop(): T | undefined { return this._data.pop(); }
  public clear(): void { this._data = []; }
}

/** Base class for any ToolModel that creates Measurements.
 * It is templated so that all functions return the correct measurement subclass.
 */
export abstract class MeasurementToolModel<T extends Measurement> {

  private _measurements: T[];
  private _redoStack: Stack<T>;
  private _ignoreMeasurementsRemoved: boolean;
  private _initialized: boolean;

  /** When true, new measurements will be added/removed from the selection set */
  public synchMeasurementsWithSelectionSet = false;

  /** Event when a new dynamic measurement is created. */
  public readonly onNewMeasurement = new BeUiEvent<Measurement>();

  /** Event when the dynamic measurement has changed. */
  public readonly onDynamicMeasurementChanged = new BeUiEvent<Measurement>();

  constructor() {
    this._measurements = [];
    this._redoStack = new Stack<T>();
    this._ignoreMeasurementsRemoved = false;
    this._initialized = false;
  }

  /** Returns the dynamic measurement or undefined. */
  public get dynamicMeasurement(): T | undefined { return undefined; }

  /** Resets the toolModel to its initial state, optionally clearing measurements. */
  public reset(clearMeasurements: boolean): void {
    if (clearMeasurements)
      this.clearMeasurements();
    else
      IModelApp.viewManager.invalidateDecorationsAllViews(); // Might have decorations in multiple viewports
  }

  /** Returns all the measurements. */
  public get measurements(): ReadonlyArray<T> {
    return this._measurements;
  }

  /** Returns a reference to the measurements array of this toolModel. */
  public get measurementsRef(): T[] {
    return this._measurements;
  }

  /** Gets if the model has been initialized */
  public get isInitialized(): boolean {
    return this._initialized;
  }

  /** Returns true if undo is possible. */
  public get canUndo(): boolean { return 0 < this._measurements.length; }
  /** Returns true if redo is possible. */
  public get canRedo(): boolean { return !this._redoStack.isEmpty; }

  /** Undo (deletes) the last measurement.
   * * NOTE: ignores the current state of the ToolModel
   */
  public undoMeasurement(): boolean {
    if (0 === this._measurements.length)
      return false;

    const m = this._measurements.pop()!;
    this._redoStack.push(m);
    // Drop will remove from selection set, and notify events
    this.removeMeasurementsFromManager(m);

    IModelApp.viewManager.invalidateDecorationsAllViews();
    return true;
  }

  /** Redo the (previously undone) measurement.
   * * NOTE: ignores the current state of the ToolModel
   */
  public redoMeasurement(): boolean {
    if (this._redoStack.isEmpty)
      return false;

    const m = this._redoStack.pop()!;
    this._measurements.push(m);
    // Add measurement(s) to manager, this notifies events but doesn't automatically select
    MeasurementManager.instance.addMeasurement(m);

    if (this.synchMeasurementsWithSelectionSet)
      MeasurementSelectionSet.global.add(m);

    IModelApp.viewManager.invalidateDecorationsAllViews();
    return true;
  }

  protected addMeasurementAndReset(...measurement: T[]): void {
    this._measurements.push(...measurement);
    this.reset(false);

    this._redoStack.clear();

    // Add measurement(s) to manager, this notifies events but doesn't automatically select
    MeasurementManager.instance.addMeasurement(measurement);

    if (this.synchMeasurementsWithSelectionSet)
      MeasurementSelectionSet.global.add(measurement);
  }

  public initialize() {
    if (this._initialized)
      return;

    this._initialized = true;
    this.reset(true); // Shouldn't have any measurements anyways...
    MeasurementManager.instance.onMeasurementsRemoved.addListener(this.handleMeasurementRemoved, this);
  }

  public cleanup() {
    MeasurementManager.instance.onMeasurementsRemoved.removeListener(this.handleMeasurementRemoved, this);
    this.reset(true); // If measurements got persisted, shouldn't have any measurements, otherwise remove them...
    this._initialized = false;
  }

  // Handle any of our measurements being removed externally while the tool is active (e.g. toolbar was opened or measurements cleared)
  private handleMeasurementRemoved(measurements: Measurement[]) {
    if (this._ignoreMeasurementsRemoved)
      return;

    for (const m of measurements) {
      const asT = m as T;
      if (!asT)
        continue;

      const index = this._measurements.indexOf(asT, 0);
      if (index > -1)
        this._measurements.splice(index, 1);
    }
  }

  protected notifyNewMeasurement() {
    if (!this.dynamicMeasurement)
      return;

    this.onNewMeasurement.emit(this.dynamicMeasurement);
    this.notifyDynamicMeasurementChanged();
  }

  protected notifyDynamicMeasurementChanged() {
    if (!this.dynamicMeasurement)
      return;

    this.onDynamicMeasurementChanged.emit(this.dynamicMeasurement);
    SyncUiEventDispatcher.dispatchSyncUiEvent(MeasurementSyncUiEventId.DynamicMeasurementChanged);
  }

  /** Performs any final logic to ensure measurements are valid after a tool commits them. The current list of measurements are cleared. */
  public persistMeasurements(): boolean {
    if (0 === this._measurements.length)
      return false;

    // Measurements are already in the manager, so we don't have to do anything special by default. But we do want to clear the current list so we don't hold onto them after
    this._measurements = [];
    this._redoStack.clear();
    return true;
  }

  /** Clears the completed measurement this tool owns. */
  public clearMeasurements(viewType?: string): void {
    if (0 === this._measurements.length)
      return;

    let removeList;
    const keepList = new Array<T>();

    // If removing for a specific type of viewport, we will add it to a remove list and set the current group of measurements from a kept list
    if (viewType !== undefined && viewType !== WellKnownViewType.Any) {
      removeList = new Array<T>();

      for (const measurement of this._measurements) {
        if (measurement.viewTarget.isOfViewType(viewType))
          removeList.push(measurement);
        else
          keepList.push(measurement);
      }
    } else {
      removeList = this._measurements;
    }

    this._measurements = keepList;

    // Drop will remove from selection set, and notify events
    this.removeMeasurementsFromManager(removeList);
  }

  /** Returns true if the supplied `id` belong to one of the measurements. */
  public testDecorationHit(id: string): boolean {
    const pickContext = MeasurementPickContext.createFromSourceId(id);

    const dynamic = this.dynamicMeasurement;
    if (dynamic && dynamic.testDecorationHit(pickContext))
      return true;

    return false;
  }

  /** Return snappable geometry for the hit measurement, or undefined. */
  public getDecorationGeometry(hit: HitDetail): GeometryStreamProps | undefined {
    const pickContext = MeasurementPickContext.create(hit);

    const dynamic = this.dynamicMeasurement;
    if (dynamic && dynamic.testDecorationHit(pickContext))
      return dynamic.getDecorationGeometry(pickContext);

    return undefined;
  }

  /** Returns the tooltip of the located measurement. */
  public async getToolTip(hit: HitDetail): Promise<HTMLElement | string> {
    const pickContext = MeasurementPickContext.create(hit);

    const dynamic = this.dynamicMeasurement;
    if (dynamic && dynamic.testDecorationHit(pickContext))
      return dynamic.getDecorationToolTip(pickContext);

    return "";
  }

  /** Decorate the measurements in the provided viewport. */
  public decorate(context: DecorateContext): void {
    const dynamic = this.dynamicMeasurement;
    if (dynamic && dynamic.viewTarget.isViewportCompatible(context.viewport)) {
      dynamic.decorateCached(context); // Not yet added to the manager, so this has to be called explicitly
      dynamic.decorate(context);
    }
  }

  private removeMeasurementsFromManager(measurements: Measurement | Measurement[]) {
    this._ignoreMeasurementsRemoved = true;
    try {
      MeasurementManager.instance.dropMeasurement(measurements);
    } finally {
      this._ignoreMeasurementsRemoved = false;
    }
  }
}
