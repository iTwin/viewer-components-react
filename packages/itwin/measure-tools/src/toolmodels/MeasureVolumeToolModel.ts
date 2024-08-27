/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { MeasurementToolModel } from "../api/MeasurementToolModel";
import type { DrawingMetadata } from "../api/Measurement";
import { VolumeMeasurement } from "../measurements/VolumeMeasurement";
import type { BeButtonEvent } from "@itwin/core-frontend";

enum State {
  SetMeasurementViewport,
  AddPoint,
}

export class MeasureVolumeToolModel extends MeasurementToolModel<VolumeMeasurement> {
  public static State = State;

  private _currentState: State;
  private _currentViewportType?: string;
  private _currentMeasurement?: VolumeMeasurement;

  constructor() {
    super();
    this._currentState = State.SetMeasurementViewport;
  }

  public get drawingMetadata(): DrawingMetadata | undefined {
    return this._currentMeasurement?.drawingMetadata;
  }

  public set drawingMetadata(data: DrawingMetadata | undefined) {
    if (this._currentMeasurement) this._currentMeasurement.drawingMetadata = data;
  }

  public set sheetViewId(id: string | undefined) {
    if (this._currentMeasurement) this._currentMeasurement.sheetViewId = id;
  }

  public get sheetViewId(): string | undefined {
    return this._currentMeasurement?.sheetViewId;
  }

  public get currentState(): State {
    return this._currentState;
  }

  public get hasEnoughPoints(): boolean {
    if (!this._currentMeasurement) return false;

    return this._currentMeasurement.isValidPolygon;
  }

  public override get dynamicMeasurement(): VolumeMeasurement | undefined {
    return this._currentMeasurement;
  }

  public setMeasurementViewport(viewType: string): boolean {
    if (State.SetMeasurementViewport !== this._currentState) return false;

    this._currentViewportType = viewType;
    this._currentState = State.AddPoint;
    return true;
  }

  public addPoint(viewType: string, ev: BeButtonEvent, isDynamic: boolean): boolean {
    if (State.AddPoint !== this._currentState) return false;

    if (viewType !== this._currentViewportType!) return false;

    if (undefined === this._currentMeasurement) {
      if (isDynamic) return false;

      this._currentMeasurement = VolumeMeasurement.create([ev.point], viewType);
      this._currentMeasurement.isDynamic = true;
      this.notifyNewMeasurement();
      return true;
    }

    if (isDynamic) {
      this._currentMeasurement.updateDynamicPolygon(ev.point);
      this.notifyDynamicMeasurementChanged();
      return true;
    }

    // &&AG some refactor needed. addPointToDynamicPolygon returns false even when it added a point successfully
    // returns only true if the polygon has been closed...
    if (this._currentMeasurement.addPointToDynamicPolygon(ev)) {
      this.notifyDynamicMeasurementChanged();
      this.addMeasurementAndReset(this._currentMeasurement);
    }

    return true;
  }

  /** Attempts to remove the last point of the current measurement.
   * * Fails if there is only one point left to prevent an invalid state.
   */
  public popMeasurementPoint(): boolean {
    if (undefined === this._currentMeasurement) return false;

    const polygon = this._currentMeasurement.polygon;
    if (1 >= polygon.points.length) return false;

    polygon.points.pop();
    this.notifyDynamicMeasurementChanged();
    return true;
  }

  public override reset(clearMeasurements: boolean): void {
    super.reset(clearMeasurements);

    this._currentMeasurement = undefined;
    this._currentState = State.SetMeasurementViewport;
  }
}
