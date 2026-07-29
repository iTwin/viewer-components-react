/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Id64Arg, Id64String } from "@itwin/core-bentley";
import { BeUiEvent, Id64 } from "@itwin/core-bentley";
import type { IModelConnection, SelectAddEvent, SelectionSetEvent, SelectRemoveEvent, SelectReplaceEvent } from "@itwin/core-frontend";
import { SelectionSetEventType } from "@itwin/core-frontend";
import { SessionStateActionId, SyncUiEventDispatcher, UiFramework } from "@itwin/appui-react";
import { Measurement } from "./Measurement.js";
import { MeasurementSyncUiEventId } from "./MeasurementEnums.js";
import { ShimFunctions } from "./ShimFunctions.js";
import type { UiSyncEventArgs } from "@itwin/appui-abstract";

export interface MeasurementSelectAddEvent {
  type: SelectionSetEventType.Add;
  added: ReadonlyArray<Measurement>;

  set: MeasurementSelectionSet;
}

export interface MeasurementSelectRemoveEvent {
  type: SelectionSetEventType.Remove | SelectionSetEventType.Clear;
  removed: ReadonlyArray<Measurement>;

  set: MeasurementSelectionSet;
}

export interface MeasurementSelectReplaceEvent {
  type: SelectionSetEventType.Replace;
  added: ReadonlyArray<Measurement>;
  removed: ReadonlyArray<Measurement>;

  set: MeasurementSelectionSet;
}

export type MeasurementSelectionSetEvent = MeasurementSelectAddEvent | MeasurementSelectRemoveEvent | MeasurementSelectReplaceEvent;

/**
 * A selection set for measurements. Element selection sets are per imodel (generally just a single imodel opened) and are only ID sets, so this
 * is intended to extend the Selection Sets by caching the actual measurements and is kept in sync with the target imodel's selection.
 */
export class MeasurementSelectionSet {
  private static _global: MeasurementSelectionSet;

  private _doNotModifySS = false;
  private _ignoreSSEvent = false;
  private _imodel?: IModelConnection;
  private _selectedMeasurements = new Array<Measurement>();
  private _idToIndexMap = new Map<Id64String, number>();

  public readonly onChanged = new BeUiEvent<MeasurementSelectionSetEvent>();

  /**
   * Gets the "Global" measurement selection set. Measurements do not belong to one single imodel and are transient elements that only exist on the frontend, so we do not have
   * a selection set per imodel. Measurement transient ID's should be taken from the imodel that the global selection set is bound to.
   * As IModels open and close the global selection tries to bind itself to any opened imodel.
   */
  public static get global(): MeasurementSelectionSet {
    if (!MeasurementSelectionSet._global)
      MeasurementSelectionSet._global = new MeasurementSelectionSet();

    return MeasurementSelectionSet._global;
  }

  /**
   * Gets the next transient ID from the current imodel. If undefined then there is no imodel.
   */
  public static get nextTransientId(): Id64String | undefined {
    const globalSS = MeasurementSelectionSet.global;
    if (globalSS.imodel)
      return globalSS.imodel.transientIds.getNext();

    return undefined;
  }

  /** Gets the imodel that corresponds to this selection set. */
  public get imodel(): IModelConnection | undefined {
    this.ensureActiveModel();

    return this._imodel;
  }

  /** Gets of all the currently selected measurements. This allocates a new array with each measurement. Use the iterator if you wish to iterate over the selected measurements and not create array copies. */
  public get measurements(): Measurement[] {
    return this._selectedMeasurements.filter((measure) => measure !== NullMeasurement.invalid);
  }

  /** Gets the number of selected measurements. */
  public get size(): number {
    return this._idToIndexMap.size;
  }

  private constructor() {
    this.startEvents();
    this.ensureActiveModel();
  }

  public *[Symbol.iterator]() {
    for (const measure of this._selectedMeasurements) {
      if (measure === NullMeasurement.invalid)
        continue;

      yield measure;
    }
  }

  public getArray(idArg: Id64Arg): Measurement[] {
    const measurements = new Array<Measurement>();

    for (const id of idArg) {
      const index = this._idToIndexMap.get(id);
      if (index !== undefined)
        measurements.push(this._selectedMeasurements[index]);
    }

    return measurements;
  }

  public get(id: Id64String): Measurement | undefined {
    const index = this._idToIndexMap.get(id);
    if (index !== undefined)
      return this._selectedMeasurements[index];

    return undefined;
  }

  public isSelected(id: Id64String): boolean {
    return this._idToIndexMap.has(id);
  }

  public add(measurements: Measurement | Measurement[]): boolean {
    if (!this.imodel)
      return false;

    const evtArray = [];
    const idSet = new Set<Id64String>();

    // Handle add, filter out duplicates or invalid IDs
    const arr = Array.isArray(measurements) ? measurements : [measurements];
    for (const measure of arr) {
      if (measure && measure.transientId && !idSet.has(measure.transientId)) {
        idSet.add(measure.transientId);
        evtArray.push(measure);
        this.addSingle(measure);
      }
    }

    // If nothing to add, early out.
    if (evtArray.length === 0)
      return false;

    // Add to the selection set, except when we are responding from a SS event. Make sure we ignore the SS event since we already processed the elements.
    if (!this._doNotModifySS) {
      this._ignoreSSEvent = true;
      try {
        this.imodel.selectionSet.add(idSet);
      } finally {
        this._ignoreSSEvent = false;
      }
    }

    this.sendEvent({ type: SelectionSetEventType.Add, added: evtArray, set: this });

    return true;
  }

  // Since we want to keep measurements in an order that they were selected, if we remove measurements in the middle
  // of the array, we have to put in a special null value rather than splicing it. If we have null values at the end of the array, we want
  // to use those slots rather than grow the array.
  private addInAvailableSlotOrAppend(measurement: Measurement): number {
    for (let i = this._selectedMeasurements.length - 1; i >= 0; i--) {
      if (this._selectedMeasurements[i] === NullMeasurement.invalid) {
        // Is the next entry null? If so, keep going, if not return current index
        const nextI = i - 1;
        if (nextI >= 0 && this._selectedMeasurements[nextI] === NullMeasurement.invalid)
          continue;

        // Otherwise, add it to this slot
        this._selectedMeasurements[i] = measurement;
        return i;
      }

      // If hit a regular measurement, break and append
      break;
    }

    const index = this._selectedMeasurements.length;
    this._selectedMeasurements.push(measurement);
    return index;
  }

  private addSingle(measurement: Measurement): boolean {
    if (!measurement.transientId || this._idToIndexMap.has(measurement.transientId))
      return false;

    const index = this.addInAvailableSlotOrAppend(measurement);
    this._idToIndexMap.set(measurement.transientId, index);

    return true;
  }

  public remove(measurements: Measurement | Measurement[]): boolean {
    if (!this.imodel)
      return false;

    const evtArray = [];
    const idSet = new Set<Id64String>();

    // Handle removes, filter out duplicates or invalid IDs
    const arr = Array.isArray(measurements) ? measurements : [measurements];
    for (const measure of arr) {
      if (measure && measure.transientId && !idSet.has(measure.transientId)) {
        idSet.add(measure.transientId);
        evtArray.push(measure);
        this.removeSingle(measure);
      }
    }

    // If nothing to add, early out
    if (evtArray.length === 0)
      return false;

    // Remove from selection set, except when we are responding from a SS event. Make sure we ignore the SS event since we already processed the elements.
    if (!this._doNotModifySS) {
      this._ignoreSSEvent = true;
      try {
        this.imodel.selectionSet.remove(idSet);
      } finally {
        this._ignoreSSEvent = false;
      }
    }

    this.sendEvent({ type: SelectionSetEventType.Remove, removed: evtArray, set: this });

    return true;
  }

  private removeSingle(measurement: Measurement): boolean {
    if (!measurement.transientId)
      return false;

    const index = this._idToIndexMap.get(measurement.transientId);
    if (index === undefined)
      return false;

    // Remove the ID from the map...if it's the last ID, then reset the selected measurements array to clear up holes. Otherwise,
    // set a special null value. If we splice the array, then indices after this index will be invalid in the id-to-index map.
    this._idToIndexMap.delete(measurement.transientId);
    if (this._idToIndexMap.size === 0)
      this._selectedMeasurements = [];
    else
      this._selectedMeasurements[index] = NullMeasurement.invalid;

    return true;
  }

  public addAndRemove(add: Measurement | Measurement[], remove: Measurement | Measurement[]): boolean {
    if (!this.imodel)
      return false;

    const evtAddArray = [];
    const evtRemoveArray = [];

    const idAddSet = new Set<Id64String>();
    const idRemoveSet = new Set<Id64String>();

    // Handle adds, remove duplicates or invalid IDs
    const arrAdd = Array.isArray(add) ? add : [add];
    for (const measure of arrAdd) {
      if (measure && measure.transientId && !idAddSet.has(measure.transientId)) {
        idAddSet.add(measure.transientId);
        evtAddArray.push(measure);
        this.addSingle(measure);
      }
    }

    // Handle removes, remove duplicates or invalid IDs
    const arrRemove = Array.isArray(remove) ? remove : [remove];
    for (const measure of arrRemove) {
      if (measure && measure.transientId && !idRemoveSet.has(measure.transientId)) {
        idRemoveSet.add(measure.transientId);
        evtRemoveArray.push(measure);
        this.removeSingle(measure);
      }
    }

    // If no actual modification, early out
    if (evtAddArray.length === 0 && evtRemoveArray.length === 0)
      return false;

    // Add/Remove from selection set, except when we are responding from a SS event. Make sure we ignore the SS event since we already processed the elements.
    if (!this._doNotModifySS) {
      this._ignoreSSEvent = true;
      try {
        this.imodel.selectionSet.addAndRemove(idAddSet, idRemoveSet);
      } finally {
        this._ignoreSSEvent = false;
      }
    }

    this.sendEvent({ type: SelectionSetEventType.Replace, added: evtAddArray, removed: evtRemoveArray, set: this });

    return true;
  }

  public clear(): void {
    if (!this._imodel || this._idToIndexMap.size === 0)
      return;

    const removedMeasurements = this.measurements; // Returns a copy of all non-null measurements
    const idArray = new Array<Id64String>();
    for (const kv of this._idToIndexMap)
      idArray.push(kv[0]);

    this._idToIndexMap.clear();
    this._selectedMeasurements = [];

    // Remove from selection set, except when we are responding from a SS event. Make sure we ignore the SS event since we already processed the elements.
    if (!this._doNotModifySS) {
      this._ignoreSSEvent = true;
      try {
        this._imodel.selectionSet.remove(idArray);
      } finally {
        this._ignoreSSEvent = false;
      }
    }

    // Send a clear event with an array of all measurements that are no longer selected
    this.sendEvent({ type: SelectionSetEventType.Clear, removed: removedMeasurements, set: this });
  }

  private sendEvent(evt: MeasurementSelectionSetEvent) {
    this.onChanged.emit(evt);
    SyncUiEventDispatcher.dispatchSyncUiEvent(MeasurementSyncUiEventId.MeasurementSelectionSetChanged);
  }

  private handleSelectionSetChanged(ev: SelectionSetEvent) {
    // Early out if we're in the middle of calling add/remove/etc externally (e.g. user is calling those methods and not setting to SS).
    // Make sure we're responding to the right selection set.
    if (this._ignoreSSEvent || !this._imodel || this._imodel.selectionSet !== ev.set)
      return;

    // Since we're handling a SS change event, the SS was modified with the measurements already so no need to modify it when calling the methods below
    this._doNotModifySS = true;

    try {
      switch (ev.type) {
        case SelectionSetEventType.Add:
          this.handleSelectionAdd(ev);
          break;
        case SelectionSetEventType.Remove:
          this.handleSelectionRemoved(ev);
          break;
        case SelectionSetEventType.Clear:
          this.clear();
          break;
        case SelectionSetEventType.Replace:
          this.handleSelectionReplaced(ev);
          break;
      }
    } finally {
      this._doNotModifySS = false;
    }
  }

  private handleSelectionAdd(ev: SelectAddEvent) {
    if (!this.imodel)
      return;

    const addIdSet = Id64.toIdSet(ev.added, false);

    const addMeasurements = new Array<Measurement>();

    // We want to look up the measurement associated with the ID, so we need to look at all the measurements currently active...
    ShimFunctions.forAllMeasurements((measurement: Measurement) => {
      if (measurement.transientId && addIdSet.has(measurement.transientId))
        addMeasurements.push(measurement);

      return true;
    });

    this.add(addMeasurements);
  }

  private handleSelectionRemoved(ev: SelectRemoveEvent) {
    if (!this.imodel)
      return;

    const removeIdSet = Id64.toIdSet(ev.removed, false);
    const removeMeasurements = new Array<Measurement>();

    // All the measurements we want to remove should already be part of the cache, so we dont need to iterate over every measurement...
    for (const removeId of removeIdSet) {
      const index = this._idToIndexMap.get(removeId);
      if (index !== undefined)
        removeMeasurements.push(this._selectedMeasurements[index]);
    }

    this.remove(removeMeasurements);
  }

  private handleSelectionReplaced(ev: SelectReplaceEvent) {
    if (!this.imodel)
      return;

    const addIdSet = Id64.toIdSet(ev.added, false);
    const removeIdSet = Id64.toIdSet(ev.removed, false);
    const addMeasurements = new Array<Measurement>();
    const removeMeasurements = new Array<Measurement>();

    // Find the measurements corresponding to the ID that was modified. Removes should already have the element in the cache, but we have to iterate over
    // all measurements anyways...
    ShimFunctions.forAllMeasurements((measurement: Measurement) => {
      if (measurement.transientId) {
        if (addIdSet.has(measurement.transientId))
          addMeasurements.push(measurement);
        else if (removeIdSet.has(measurement.transientId))
          removeMeasurements.push(measurement);
      }

      return true;
    });

    this.addAndRemove(addMeasurements, removeMeasurements);
  }

  private startEvents(): void {
    SyncUiEventDispatcher.onSyncUiEvent.addListener(this.onSyncEvent, this);
  }

  private getUiFameworkIModel(): IModelConnection | undefined {
    // Apparently UiFramework errors if not initialized, because it's redux store hasn't been initialized,
    // but it's accessor throws an exception if undefined so there doesn't seem to be an easy way to check if it's been initialized...
    try {
      return UiFramework.getIModelConnection();
    } catch {
      return undefined;
    }
  }

  private onSyncEvent(args: UiSyncEventArgs) {
    if (args.eventIds.has(SessionStateActionId.SetIModelConnection))
      this.changeActiveIModel(this.getUiFameworkIModel());
  }

  private ensureActiveModel() {
    if (this._imodel)
      return;

    this.changeActiveIModel(this.getUiFameworkIModel());
  }

  private changeActiveIModel(newModel?: IModelConnection) {
    // If both undefined or the same model, do nothing
    if ((!this._imodel && !newModel) || (newModel === this._imodel))
      return;

    // Clear old model
    if (this._imodel) {
      this.clear();
      this.resetAllTransientIds();
      this._imodel.selectionSet.onChanged.removeListener(this.handleSelectionSetChanged, this);
      this._imodel = undefined;
    }

    // Set the new model
    if (newModel) {
      this._imodel = newModel;
      this._imodel.selectionSet.onChanged.addListener(this.handleSelectionSetChanged, this);
      this.synchronizeFromSelectionSet();
    }
  }

  private resetAllTransientIds() {
    ShimFunctions.forAllMeasurements((measurement: Measurement) => {
      measurement.transientId = undefined;

      return true;
    });
  }

  // Usually called on first init to ensure if anything is selected gets synchronized
  private synchronizeFromSelectionSet() {
    if (!this._imodel)
      return;

    if (this._selectedMeasurements.length > 0) {
      this._selectedMeasurements = [];
      this._idToIndexMap.clear();
    }

    const selectedSet = this._imodel.selectionSet.elements;
    ShimFunctions.forAllMeasurements((measurement: Measurement) => {
      if (measurement.transientId && selectedSet.has(measurement.transientId)) {
        const index = this._selectedMeasurements.length;
        this._selectedMeasurements.push(measurement);
        this._idToIndexMap.set(measurement.transientId, index);
      }

      return true;
    });
  }
}

/** Special measurement object to null out array entries in the selected measurement array. These are skipped over and never returned in query methods. */
class NullMeasurement extends Measurement {
  private static _invalid: NullMeasurement;

  public static get invalid(): NullMeasurement {
    if (!NullMeasurement._invalid)
      NullMeasurement._invalid = new NullMeasurement();

    return NullMeasurement._invalid;
  }

  private constructor() { super(); }

  protected override createNewInstance(): Measurement {
    return this;
  }
}
