/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Measurement } from "./Measurement.js";
import { MeasurementSyncUiEventId } from "./MeasurementEnums.js";
import { BeUiEvent } from "@itwin/core-bentley";
import { DistanceMeasurement } from "../measurements/DistanceMeasurement.js";
import { SyncUiEventDispatcher } from "@itwin/appui-react";
import { ShimFunctions } from "./ShimFunctions.js";

export type AcceptMeasurementHandler = (args: Measurement) => boolean;

/** UI events for measurements. Maintains app state of each event type, so events only trigger when the state actually changes. */
export class MeasurementUIEvents {
  private static _clearMeasurementState: boolean = false; // Default is false, only want the button to show if have measurements
  private static _shouldClearMeasurementHandler?: AcceptMeasurementHandler = undefined;

  private static _toggleMeasurementAxestate: boolean = false; // Defalt is false, only want the button to show if have measurements that have axes
  private static _showToggleMeaurementAxesHandler?: AcceptMeasurementHandler;

  /** Occurs when the visibility state of the "Clear Measurements" button changes */
  public static readonly onClearMeasurementButtonVisibilityChanged: BeUiEvent<boolean> = new BeUiEvent<boolean>();

  /** Occurs when the visibility state of the "Toggle Measurement Axes" button changes */
  public static readonly onToggleMeasurementAxesButtonVisibilityChanged: BeUiEvent<boolean> = new BeUiEvent<boolean>();

  /** Occurs whenever notifyMeasurementsChanged() is called. Query the measurement manager or active measurement tool for changes. */
  public static readonly onMeasurementsChanged: BeUiEvent<void> = new BeUiEvent<void>();

  /** Notify UI (e.g. property grid) if the following measurements have modified and need to refresh the UI. */
  public static readonly onMeasurementPropertiesChanged: BeUiEvent<Measurement[]> = new BeUiEvent<Measurement[]>();

  /** Gets or sets the User-defined handler to override default behavior of determining whether a measurement should be cleared. By default
   * the UI button is visible if there exists at least one non-locked measurement.
   */
  public static get shouldClearMeasurementHandler(): AcceptMeasurementHandler | undefined {
    return MeasurementUIEvents._shouldClearMeasurementHandler;
  }

  public static set shouldClearMeasurementHandler(handler: AcceptMeasurementHandler | undefined) {
    MeasurementUIEvents._shouldClearMeasurementHandler = handler;
  }

  /**
   * Gets or sets the User-defined handler to override default behavior of determining whether a measurement is counted towards showing
   * the "Toggle Measurement Axes" button. By default the UI button is visible if there exists at least one Distance Measurement.
   */
  public static get showToggleMeasurementAxesHandler(): AcceptMeasurementHandler | undefined {
    return MeasurementUIEvents._showToggleMeaurementAxesHandler;
  }

  public static set showToggleMeasurementAxesHandler(handler: AcceptMeasurementHandler | undefined) {
    MeasurementUIEvents._showToggleMeaurementAxesHandler = handler;
  }

  /** Get the visibility state of the "Clear Measurements" button */
  public static get isClearMeasurementButtonVisible(): boolean {
    return this._clearMeasurementState;
  }

  /** Get the visibility state of the "Toggle Measurement Axes" button */
  public static get isToggleMeasurementAxesButtonVisible(): boolean {
    return this._toggleMeasurementAxestate;
  }

  /**
   * Notify listeners who need to refresh if measurement properties have changed. E.g. measurement property grid.
   * @param measurements Measurements whose properties have changed.
   */
  public static notifyMeasurementPropertiesChanged(measurements: Measurement[]) {
    MeasurementUIEvents.onMeasurementPropertiesChanged.emit(measurements);
    SyncUiEventDispatcher.dispatchSyncUiEvent(MeasurementSyncUiEventId.MeasurementSelectionSetChanged);
  }

  /** Notify a change in measurements. If you implement a new measurement creation tool, you should call this if you make changes to it's measurement state (the measurement decorator already does this).
   */
  public static notifyMeasurementsChanged(): void {
    MeasurementUIEvents.onMeasurementsChanged.emit();
    MeasurementUIEvents.determineClearMeasurementStateChange();
    MeasurementUIEvents.determineToggleMeasurementAxesStateChange();
  }

  private static determineClearMeasurementStateChange() {
    const prevState = MeasurementUIEvents._clearMeasurementState;
    const currentState = MeasurementUIEvents.queryActiveMeasurementCount() > 0;

    if (currentState !== prevState) {
      MeasurementUIEvents._clearMeasurementState = currentState;
      MeasurementUIEvents.onClearMeasurementButtonVisibilityChanged.emit(currentState);
    }
  }

  private static determineToggleMeasurementAxesStateChange() {
    const overrideHandler = MeasurementUIEvents._showToggleMeaurementAxesHandler;
    const prevState = MeasurementUIEvents._toggleMeasurementAxestate;
    const result = { currentState: false };

    // Determine if the show axes button needs to be shown. App may provide handler to provide custom logic.
    ShimFunctions.forAllMeasurements((overrideHandler) ? (measurement: Measurement) => {
      if (overrideHandler(measurement)) {
        result.currentState = true;
        return false;
      }

      return true;
    } : (measurement: Measurement) => {
      if (measurement instanceof DistanceMeasurement) {
        result.currentState = true;
        return false;
      }

      return true;
    });

    if (result.currentState !== prevState) {
      MeasurementUIEvents._toggleMeasurementAxestate = result.currentState;
      MeasurementUIEvents.onToggleMeasurementAxesButtonVisibilityChanged.emit(result.currentState);
    }
  }

  private static queryActiveMeasurementCount(): number {
    const overrideClearHandler = MeasurementUIEvents._shouldClearMeasurementHandler;
    const result = { count: 0 };

    // Get all the non-locked measurements (by default), app may provide a handler that determines what exactly constitutes an active measurement though
    ShimFunctions.forAllMeasurements((overrideClearHandler) ? (measurement: Measurement) => {
      if (overrideClearHandler(measurement))
        result.count++;

      return true;
    } : (measurement: Measurement) => {
      if (!measurement.isLocked) {
        result.count++;
      }

      return true;
    });

    return result.count;
  }
}
