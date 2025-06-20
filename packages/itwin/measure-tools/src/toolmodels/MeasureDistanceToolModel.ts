/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Point3d } from "@itwin/core-geometry";
import { MeasurementPreferences } from "../api/MeasurementPreferences.js";
import { MeasurementToolModel } from "../api/MeasurementToolModel.js";
import type { DistanceMeasurementFormattingProps } from "../measurements/DistanceMeasurement.js";
import { DistanceMeasurement } from "../measurements/DistanceMeasurement.js";
import type { DrawingMetadata } from "../api/Measurement.js";

enum State {
  SetMeasurementViewport,
  SetStartPoint,
  SetEndPoint,
}

export class MeasureDistanceToolModel extends MeasurementToolModel<DistanceMeasurement> {
  public static State = State;

  private _currentState: State;
  private _currentViewportType?: string;
  private _currentMeasurement?: DistanceMeasurement;
  private  _formatting?: DistanceMeasurementFormattingProps;

  constructor() {
    super();
    this._currentState = State.SetMeasurementViewport;
  }

  public get formatting(): DistanceMeasurementFormattingProps | undefined { return this._formatting; }
  public set formatting(formatting: DistanceMeasurementFormattingProps | undefined) { this._formatting = formatting; }

  public get currentState(): State { return this._currentState; }

  public override get dynamicMeasurement(): DistanceMeasurement | undefined { return this._currentMeasurement; }

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

  public setMeasurementViewport(viewType: string): boolean {
    if (State.SetMeasurementViewport !== this._currentState)
      return false;

    this._currentViewportType = viewType;
    this.moveToNextState();
    return true;
  }

  public setStartPoint(viewType: string, point: Point3d): boolean {
    if (State.SetStartPoint !== this._currentState)
      return false;

    if (viewType !== this._currentViewportType!)
      return false;

    this._currentMeasurement = DistanceMeasurement.create(point, point, this._currentViewportType, this._formatting);
    this._currentMeasurement.isDynamic = true;
    this._currentMeasurement.showAxes = false; // Turn off axes for new dynamic measurements
    this.notifyNewMeasurement();
    this.moveToNextState();
    return true;
  }

  public setEndPoint(viewType: string, point: Point3d, isDynamic: boolean): boolean {
    if (State.SetEndPoint !== this._currentState)
      return false;

    if (viewType !== this._currentViewportType!)
      return false;

    this._currentMeasurement!.setEndPoint(point);
    this.notifyDynamicMeasurementChanged();
    if (!isDynamic)
      this.moveToNextState();

    return true;
  }

  private moveToNextState(): void {
    switch (this._currentState) {
      case State.SetMeasurementViewport:
        this._currentState = State.SetStartPoint;
        break;
      case State.SetStartPoint:
        this._currentState = State.SetEndPoint;
        break;
      case State.SetEndPoint:
        this._currentMeasurement!.isDynamic = false;
        this._currentMeasurement!.showAxes = MeasurementPreferences.current.displayMeasurementAxes; // Turn axes on if its preferred
        this.addMeasurementAndReset(this._currentMeasurement!);
        break;
    }
  }

  public override reset(clearMeasurements: boolean): void {
    super.reset(clearMeasurements);

    this._currentMeasurement = undefined;
    this._currentState = State.SetMeasurementViewport;
  }
}
