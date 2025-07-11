/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Point3d } from "@itwin/core-geometry";
import type { AreaMeasurementFormattingProps } from "../measurements/AreaMeasurement.js";
import { AreaMeasurement } from "../measurements/AreaMeasurement.js";
import { MeasurementToolModel } from "../api/MeasurementToolModel.js";
import type { DrawingMetadata } from "../api/Measurement.js";

enum State {
  SetMeasurementViewport,
  AddPoint,
}

export class MeasureAreaToolModel extends MeasurementToolModel<AreaMeasurement> {
  public static State = State;

  private _currentState: State;
  private _currentViewportType?: string;
  private _currentMeasurement?: AreaMeasurement;
  private _formatting?: AreaMeasurementFormattingProps;

  constructor() {
    super();
    this._currentState = State.SetMeasurementViewport;
  }

  public get formatting(): AreaMeasurementFormattingProps | undefined { return this._formatting; }
  public set formatting(formatting: AreaMeasurementFormattingProps | undefined) { this._formatting = formatting; }

  public get drawingMetadata(): DrawingMetadata | undefined {
    return this._currentMeasurement?.drawingMetadata;
  }

  public set drawingMetadata(data: DrawingMetadata | undefined) {
    if (this._currentMeasurement)
      this._currentMeasurement.drawingMetadata = data;
  }

  public set sheetViewId(id: string | undefined) {
    if (this._currentMeasurement)
      this._currentMeasurement.sheetViewId = id;
  }

  public get sheetViewId(): string | undefined {
    return this._currentMeasurement?.sheetViewId;
  }

  public get currentState(): State { return this._currentState; }

  public get hasEnoughPoints(): boolean {
    if (!this._currentMeasurement)
      return false;

    return this._currentMeasurement.isValidPolygon;
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

      this._currentMeasurement = AreaMeasurement.create([point], viewType, this._formatting);
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
