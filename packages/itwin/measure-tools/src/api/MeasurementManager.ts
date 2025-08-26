/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BeUiEvent } from "@itwin/core-bentley";
import { EventHandled, IModelApp } from "@itwin/core-frontend";
import { MeasurementPickContext } from "./Measurement.js";
import { MeasurementCachedGraphicsHandler } from "./MeasurementCachedGraphicsHandler.js";
import { MeasurementButtonHandledEvent, WellKnownViewType } from "./MeasurementEnums.js";
import { MeasurementSelectionSet } from "./MeasurementSelectionSet.js";
import { MeasurementUIEvents } from "./MeasurementUIEvents.js";
import { ShimFunctions } from "./ShimFunctions.js";

import type { GeometryStreamProps } from "@itwin/core-common";
import type { BeButtonEvent, DecorateContext, Decorator, HitDetail, ScreenViewport, Viewport } from "@itwin/core-frontend";
import type { IModelConnection } from "@itwin/core-frontend";
import type { Measurement} from "./Measurement.js";
/** Handler for overriding what is returned for the tooltip of a measurement. */
export type MeasurementToolTipHandler = (measurement: Measurement, pickContext: MeasurementPickContext) => Promise<HTMLElement | string>;

/** Handler for overriding what is returned for pick-able geometry of a measurement. */
export type MeasurementGeometryHandler = (measurement: Measurement, pickContext: MeasurementPickContext) => GeometryStreamProps | undefined;

/** Handler ofr overriding to determine if a measurement has been picked or not. */
export type MeasurementHitHandler = (measurement: Measurement, pickContext: MeasurementPickContext) => boolean;

/** Button event details */
export interface MeasurementButtonEvent {
  measurement: Measurement;
  pickContext: MeasurementPickContext;
}

/**
 * Singleton manager which maintains a list of all active measurements once they are created by a measurement tool. The manager facilitates drawing and picking of measurements
 * to the appropriate viewport.
 */
export class MeasurementManager implements Decorator {
  private static _instance?: MeasurementManager;

  private _measurements: Measurement[] = new Array<Measurement>();
  private _dropDecoratorCallback?: () => void;
  private _dropQuantityFormatterListeners?: () => void;
  private _dropGlobalOriginChangedCallback?: () => void;
  private _iModelIdForGlobalOrigin?: string;
  private _overrideToolTipHandler?: MeasurementToolTipHandler;
  private _overrideGeometryHandler?: MeasurementGeometryHandler;
  private _overrideHitHandler?: MeasurementHitHandler;

  /** Event that is invoked when a measurement has responded to a button event. */
  public readonly onMeasurementButtonEvent: BeUiEvent<MeasurementButtonEvent> = new BeUiEvent<MeasurementButtonEvent>();

  /** Event that is invoked when a measurement is added. */
  public readonly onMeasurementsAdded: BeUiEvent<Measurement[]> = new BeUiEvent<Measurement[]>();

  /** Event that is invoked when a measurement is dropped or cleared. */
  public readonly onMeasurementsRemoved: BeUiEvent<Measurement[]> = new BeUiEvent<Measurement[]>();

  /** Gets the manager instance. */
  public static get instance(): MeasurementManager {
    if (!this._instance)
      this._instance = new MeasurementManager();

    return this._instance;
  }

  /** Gets a readonly array of measurements the manager owns. This does not include any transient measurements an active tool is displaying. */
  public get measurements(): ReadonlyArray<Measurement> {
    return this._measurements;
  }

  /** Gets or sets an override tooltip handler. If defined, this overrides what is returned in getDecorationToolTip. */
  public get overrideToolTipHandler(): MeasurementToolTipHandler | undefined {
    return this._overrideToolTipHandler;
  }

  public set overrideToolTipHandler(handler: MeasurementToolTipHandler | undefined) {
    this._overrideToolTipHandler = handler;
  }

  /** Gets or sets an override geometry handler. If defined, this overrides what is returned in getDecorationGeometry. */
  public get overrideGeometryHandler(): MeasurementGeometryHandler | undefined {
    return this._overrideGeometryHandler;
  }

  public set overrideGeometryHandler(handler: MeasurementGeometryHandler | undefined) {
    this._overrideGeometryHandler = handler;
  }

  /** Gets or sets an override hit handler. If defined, this overrides the logic in testDecorationHit. */
  public get overrideHitHandler(): MeasurementHitHandler | undefined {
    return this._overrideHitHandler;
  }

  public set overrideHitHandler(handler: MeasurementHitHandler | undefined) {
    this._overrideHitHandler = handler;
  }

  /** Adds one or more measurements to the manager.
   * @param measurement one or more measurements to add.
   */
  public addMeasurement(measurement: Measurement | Measurement[]): void {

    const arr = Array.isArray(measurement) ? measurement : [measurement];
    this._measurements.push(...arr);
    this.onMeasurementsAdded.emit(arr);

    MeasurementUIEvents.notifyMeasurementsChanged();
    this.invalidateDecorationsAllViews();
  }

  /**
   * Iterates over all measurements owned by the manager.
   * @param callback Callback to invoke for each measurement, return true to keep iterating or false to early out.
   */
  public forAllMeasurements(callback: (measurement: Measurement) => boolean) {
    this._measurements.every(callback);
  }

  /**
   * Queries measurements that can be drawn in a given view type.
   * @param viewType view type to find measurements for. Can be any [[WellKnownViewType]] or an app-defined one.
   * @returns an array of measurements that are valid for the view type or an empty array if none were found.
   */
  public getMeasurementsForViewType(viewType: string): Measurement[] {
    if (viewType === WellKnownViewType.Any)
      return this._measurements.slice();

    return this.getMeasurementsForPredicate((measurement: Measurement) => {
      return measurement.viewTarget.isOfViewType(viewType);
    });
  }

  /**
   * Queries measurements that can be drawn in a given viewport.
   * @param vp Viewport to find measurements for.
   * @returns an array of measurements that are valid for the viewport or an empty array if none were found.
   */
  public getMeasurementsForViewport(vp: Viewport): Measurement[] {
    return this.getMeasurementsForPredicate((measurement: Measurement) => {
      return measurement.viewTarget.isViewportCompatible(vp);
    });
  }

  /** Queries measurements that belong to the group, and optionally subgroup.
   * @param groupId ID of the group
   * @param subgroupId Optional ID of the subgroup
   * @returns an array of measurements that belong to the specified group.
   */
  public getMeasurementsForGroup(groupId: string, subgroupId?: string): Measurement[] {
    return this.getMeasurementsForPredicate((measurement: Measurement) => {
      // If subgroupId is still undefined, we want to include that as a hit
      if (measurement.groupId === groupId)
        return measurement.subgroupId === subgroupId;

      return false;
    });
  }

  /** Queries measurements based on a user-defined predicate.
   * @param callback Defines the criteria for what the measurement needs to satisfy to be returned.
   * @returns an array of measurements that satisfy the predicate.
   */
  public getMeasurementsForPredicate(callback: (measurement: Measurement) => boolean): Measurement[] {
    return this._measurements.filter(callback);
  }

  /** Removes one or more measurements from the manager.
   * @param measurement one or more measurements to remove.
   * @returns true if the measurements were dropped, false if none were found.
   */
  public dropMeasurement(measurement: Measurement | Measurement[]): boolean {
    const keepMeasurements = [];
    const removed = [];

    // For each measurement we own, find it in the drop list. If not in the drop list, add it to a new list of kept measurements
    const arr = Array.isArray(measurement) ? measurement : [measurement];
    for (const elem of this._measurements) {
      const index = arr.indexOf(elem);
      if (index > -1) {
        removed.push(elem); // In list, so we found something to drop
        elem.onCleanup();
      } else {
        keepMeasurements.push(elem); // Not in list, add to keeps
      }
    }

    if (0 === removed.length)
      return false;

    this._measurements = keepMeasurements;
    this.onMeasurementsRemoved.emit(removed);
    MeasurementSelectionSet.global.remove(measurement);
    MeasurementUIEvents.notifyMeasurementsChanged();
    this.invalidateDecorationsAllViews();
    return true;
  }

  /**
   * Removes any measurements from the manager based on the view type.
   * @param viewType view type to find measurements for. Can be any [[WellKnownViewType]] or an app-defined one.
   * @returns an array of measurements that were dropped, or empty if none were.
   */
  public dropMeasurementsForViewType(viewType: string): Measurement[] {
    if (viewType === WellKnownViewType.Any) {
      const dropped = this._measurements;
      this.clear(true);
      return dropped;
    }

    return this.dropMeasurementsForPredicate((measurement: Measurement) => {
      return measurement.viewTarget.isOfViewType(viewType);
    });
  }

  /** Removes any measurements from the manager for a given viewport.
   * @param vp Viewport to find measurements to drop for.
   * @returns an array of measurements that were dropped, or empty if none were.
   */
  public dropMeasurementForViewport(vp: Viewport): Measurement[] {
    return this.dropMeasurementsForPredicate((measurement: Measurement) => {
      return measurement.viewTarget.isViewportCompatible(vp);
    });
  }

  /** Removes one or more measurements that belong to the given group.
   * @param groupId ID of the group.
   * @param subgroupId Optional ID of the subgroup.
   * @returns an array of measurements removed from the decorator.
   */
  public dropMeasurementsForGroup(groupId: string, subgroupId?: string): Measurement[] {
    return this.dropMeasurementsForPredicate((measurement: Measurement) => {
      // If subgroupId is still undefined, we want to include that as a hit
      if (measurement.groupId === groupId)
        return measurement.subgroupId === subgroupId;

      return false;
    });
  }

  /** Removes one or more measurements that satisfy the predicate.
   * @param callback Defines the criteria for whether or not the measurement should be removed.
   * @returns an array of measurements removed from the decorator.
   */
  public dropMeasurementsForPredicate(callback: (measurement: Measurement) => boolean): Measurement[] {
    const measurementsKept = [];
    const measurementsDropped = [];

    for (const elem of this._measurements) {
      if (callback(elem)) {
        measurementsDropped.push(elem);
        elem.onCleanup();
      } else {
        measurementsKept.push(elem);
      }
    }

    this._measurements = measurementsKept;

    if (measurementsDropped.length > 0) {
      this.onMeasurementsRemoved.emit(measurementsDropped);
      MeasurementSelectionSet.global.remove(measurementsDropped);
      MeasurementUIEvents.notifyMeasurementsChanged();
      this.invalidateDecorationsAllViews();
    }

    return measurementsDropped;
  }

  /** Clears measurements from the manager.
   * @param clearLocked true if locked measurements should be cleared as well as non-locked, false to not clear locked measurements.
   */
  public clear(clearLocked: boolean = true): void {
    const temp = new Array<Measurement>();
    let removed;
    let count = 0;

    // If clear locked, then clearing all
    if (clearLocked) {
      count = this._measurements.length;
      removed = this._measurements;
    } else {
      removed = [];

      // Otherwise, clear non-locked by adding locked to the new array
      for (const measurement of this._measurements) {
        if (measurement.isLocked) {
          temp.push(measurement);
        } else {
          count++;
          removed.push(measurement);
        }
      }
    }

    this._measurements = temp;

    // If removed anything, notify UI
    if (count > 0) {
      // Call cleanup on any measurement to be removed
      for (const m of removed)
        m.onCleanup();

      this.onMeasurementsRemoved.emit(removed);
      MeasurementSelectionSet.global.clear();
      MeasurementUIEvents.notifyMeasurementsChanged();
      this.invalidateDecorationsAllViews();
    }
  }

  /** Tests if the pick ID belongs to any measurement.
   * @param id pick ID used by graphics the measurement generates for drawing.
   * @returns true if the measurement has been picked, false otherwise.
   */
  public testDecorationHit(id: string): boolean {
    const pickContext = MeasurementPickContext.createFromSourceId(id);
    if (this._overrideHitHandler) {
      for (const measurement of this._measurements) {
        if (measurement.isVisible && this._overrideHitHandler(measurement, pickContext))
          return true;
      }
    } else {
      for (const measurement of this._measurements) {
        if (measurement.isVisible && measurement.testDecorationHit(pickContext))
          return true;
      }
    }

    return false;
  }

  /** Get a geometry stream representing the pickable geometry of any measurement currently picked. Usually this is simplier geometry than what is drawn.
   * @param hit Current picking context.
   * @returns a geometry stream of pickable data or undefined.
   */
  public getDecorationGeometry(hit: HitDetail): GeometryStreamProps | undefined {
    const pickContext = MeasurementPickContext.create(hit);
    for (const measurement of this._measurements) {
      if (measurement.isVisible && measurement.testDecorationHit(pickContext))
        return (this._overrideGeometryHandler) ? this._overrideGeometryHandler(measurement, pickContext) : measurement.getDecorationGeometry(pickContext);
    }

    return undefined;
  }

  /** Get a tooltip for any measurement currently picked.
   * @param hit Current picking context.
   * @returns a tooltip HTML element or string.
   */
  public async getDecorationToolTip(hit: HitDetail): Promise<HTMLElement | string> {
    const pickContext = MeasurementPickContext.create(hit);
    for (const measurement of this._measurements) {
      if (measurement.isVisible && measurement.testDecorationHit(pickContext))
        return (this._overrideToolTipHandler) ? this._overrideToolTipHandler(measurement, pickContext) : measurement.getDecorationToolTip(pickContext);
    }

    return "";
  }

  /** Handles button events on any measurements that have been picked.
   * @param hit Current picking context.
   * @param ev Current button event.
   * @returns enum whether the event has been handled or not.
   */
  public async onDecorationButtonEvent(hit: HitDetail, ev: BeButtonEvent): Promise<EventHandled> {
    const pickContext = MeasurementPickContext.create(hit, ev);

    for (const measurement of this._measurements) {
      if (!measurement.isVisible)
        continue;

      const handled = await measurement.onDecorationButtonEvent(pickContext);

      // Early out if event was handled. Potentially check if we want to consume the event or not.
      switch (handled) {
        case MeasurementButtonHandledEvent.YesConsumeEvent:
          return EventHandled.Yes;
        case MeasurementButtonHandledEvent.Yes:
          return EventHandled.No;
      }
    }

    return EventHandled.No;
  }

  /**
   * Notifies the event handler the measurement has responded to a button event.
   * @param measurement Measurement that responded to the event.
   * @param pickContext Current pick context.
   */
  public notifyMeasurementButtonEvent(measurement: Measurement, pickContext: MeasurementPickContext) {
    this.onMeasurementButtonEvent.emit({ measurement, pickContext });
  }

  /** Draws all valid measurements to a given viewport. Measurements that do not have the correct viewport type are not drawn to the viewport.
   * @param context Decorate context for drawing to a viewport.
   */
  public decorate(context: DecorateContext): void {
    this.tryAddGlobalOriginChangedListener(context.viewport.iModel);
    for (const measurement of this._measurements) {
      if (measurement.isVisible && measurement.viewTarget.isViewportCompatible(context.viewport))
        measurement.decorate(context);
    }
  }

  /** Draws all measurements that have cached graphics to a given viewport. Measurements that do not have the correct viewport type are not drawn to the viewport.
   * @param context Decorate context for drawing to a viewport.
   */
  public decorateCached(context: DecorateContext): void {
    this.tryAddGlobalOriginChangedListener(context.viewport.iModel);
    for (const measurement of this._measurements) {
      if (measurement.isVisible && measurement.viewTarget.isViewportCompatible(context.viewport))
        measurement.decorateCached(context);
    }
  }

  private tryAddGlobalOriginChangedListener(iModel: IModelConnection): void {
    if (this._iModelIdForGlobalOrigin !== iModel.iModelId) {
      if (this._dropGlobalOriginChangedCallback)
        this._dropGlobalOriginChangedCallback();

      this._dropGlobalOriginChangedCallback = iModel.onGlobalOriginChanged.addListener(this.onActiveUnitSystemChanged, this);
      this._iModelIdForGlobalOrigin = iModel.iModelId;
    }
  }

  /** Invalidates decorations in all views, including any cached graphics measurements may be using. */
  public invalidateDecorationsAllViews(): void {
    IModelApp.viewManager.invalidateDecorationsAllViews();
    MeasurementCachedGraphicsHandler.instance.invalidateDecorations();
  }

  /** Invalidates decorations in a specified viewport. If undefined then all viewports are invalidated. This includes any cached graphics measurements may be using.
   * @param vp Viewport to invalidate decorations, if undefined all viewports.
  */
  public invalidateDecorations(vp?: ScreenViewport): void {
    if (vp) {
      vp.invalidateDecorations();
      MeasurementCachedGraphicsHandler.instance.invalidateDecorations(vp);
    } else {
      this.invalidateDecorationsAllViews();
    }
  }

  /** Adds the decorator singleton to the view manager's list of active decorators. The decorator will participate in drawing and picking operations. */
  public startDecorator(): void {
    if (this._dropDecoratorCallback)
      return;

    MeasurementCachedGraphicsHandler.instance.setDecorateCallback(this.decorateCached.bind(this));
    MeasurementCachedGraphicsHandler.instance.startDecorator();
    this._dropDecoratorCallback = IModelApp.viewManager.addDecorator(this);

    if (undefined === this._dropQuantityFormatterListeners) {
      const unsubscribers = [IModelApp.quantityFormatter.onActiveFormattingUnitSystemChanged.addListener(this.onActiveUnitSystemChanged, this),
        IModelApp.quantityFormatter.onQuantityFormatsChanged.addListener(this.onActiveUnitSystemChanged, this),
        IModelApp.quantityFormatter.onUnitsProviderChanged.addListener(this.onActiveUnitSystemChanged, this),
        IModelApp.formatsProvider.onFormatsChanged.addListener(async () => {
          await this.onFormatsChanged();
        }, this)
      ];
      this._dropQuantityFormatterListeners = () => unsubscribers.forEach((unsubscriber) => {
        unsubscriber();
      });

    } else {
      this.onActiveUnitSystemChanged();
    }
  }

  /** Removes the decorator singleton from the view manager's list of active decorators. The decorator will still manage measurements, but will not
   * participate in drawing or picking operations.
   */
  public stopDecorator(): void {
    if (this._dropDecoratorCallback) {
      this._dropDecoratorCallback();
      this._dropDecoratorCallback = undefined;
    }

    if (this._dropQuantityFormatterListeners) {
      this._dropQuantityFormatterListeners();
      this._dropQuantityFormatterListeners = undefined;
    }

    MeasurementCachedGraphicsHandler.instance.setDecorateCallback(undefined);
    MeasurementCachedGraphicsHandler.instance.stopDecorator();
  }

  public onActiveUnitSystemChanged() {
    for (const measurement of this._measurements) {
      measurement.onDisplayUnitsChanged();
    }
  }

  public async onFormatsChanged() {
    for (const measurement of this._measurements) {
      await measurement.populateFormattingSpecsRegistry(true);
      measurement.onDisplayUnitsChanged();
      this.invalidateDecorations();
    }
    MeasurementUIEvents.notifyMeasurementPropertiesChanged(this._measurements)
  }
}

// Avoid circular dependency with webpack
ShimFunctions.getAllMeasurements = () => {
  return MeasurementManager.instance.measurements;
};

// Avoid circular ependency with webpack
ShimFunctions.forAllMeasurements = (callback: (measurement: Measurement) => boolean) => { MeasurementManager.instance.forAllMeasurements(callback); };
