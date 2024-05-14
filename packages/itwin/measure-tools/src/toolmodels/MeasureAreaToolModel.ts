/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Point3d } from "@itwin/core-geometry";
import { AreaMeasurement } from "../measurements/AreaMeasurement";
import { MeasurementToolModel } from "../api/MeasurementToolModel";

enum State {
  SetMeasurementViewport,
  AddPoint,
}

export class MeasureAreaToolModel extends MeasurementToolModel<AreaMeasurement> {
  public static State = State;

  private _currentState: State;
  private _currentViewportType?: string;
  private _currentMeasurement?: AreaMeasurement;
  private _firstPointDrawingId?: string;

  constructor() {
    super();
    this._currentState = State.SetMeasurementViewport;
  }

  public get firstPointDrawingId(): string | undefined {
    return this._firstPointDrawingId;
  }

  public set firstPointDrawingId(newId: string | undefined) {
    this._firstPointDrawingId = newId;
  }

  public get currentState(): State { return this._currentState; }

  public get hasEnoughPoints(): boolean {
    if (!this._currentMeasurement)
      return false;

    return this._currentMeasurement.isValidPolygon;
  }

  public setRatio(ratio: number | undefined) {
    this._currentMeasurement?.setRatio(ratio);
  }

  public override get dynamicMeasurement(): AreaMeasurement | undefined { return this._currentMeasurement; }

  public setMeasurementViewport(viewType: string): boolean {
    if (State.SetMeasurementViewport !== this._currentState)
      return false;

    this._currentViewportType = viewType;
    this._currentState = State.AddPoint;
    return true;
  }

  public addPoint(viewType: string, point: Point3d, isDynamic: boolean): boolean {
    if (State.AddPoint !== this._currentState)
      return false;

    if (viewType !== this._currentViewportType!)
      return false;

    if (undefined === this._currentMeasurement) {
      if (isDynamic)
        return false;

      this._currentMeasurement = AreaMeasurement.create([point], viewType);
      this._currentMeasurement.isDynamic = true;
      this.notifyNewMeasurement();
      return true;
    }

    if (isDynamic) {
      this._currentMeasurement.updateDynamicPolygon(point);
      this.notifyDynamicMeasurementChanged();
      return true;
    }

    // &&AG some refactor needed. addPointToDynamicPolygon returns false even when it added a point successfully
    // returns only true if the polygon has been closed...
    if (this._currentMeasurement.addPointToDynamicPolygon(point)) {
      this.notifyDynamicMeasurementChanged();
      this.addMeasurementAndReset(this._currentMeasurement);
    }

    return true;
  }

  /** Attemps to remove the last point of the current measurement.
   * * Fails if there is only one point left to prevent an invalid state.
   */
  public popMeasurementPoint(): boolean {
    if (undefined === this._currentMeasurement)
      return false;

    const polygon = this._currentMeasurement.polygon;
    if (1 >= polygon.points.length)
      return false;

    polygon.points.pop();
    polygon.recomputeFromPoints();
    this.notifyDynamicMeasurementChanged();
    return true;
  }

  public tryCommitMeasurement(): boolean {
    if (!this._currentMeasurement)
      return false;

    if (!this._currentMeasurement.closeDynamicPolygon())
      return false;

    this.notifyDynamicMeasurementChanged();
    this.addMeasurementAndReset(this._currentMeasurement);
    return true;
  }

  public override reset(clearMeasurements: boolean): void {
    super.reset(clearMeasurements);

    this._currentMeasurement = undefined;
    this._currentState = State.SetMeasurementViewport;
  }
}
