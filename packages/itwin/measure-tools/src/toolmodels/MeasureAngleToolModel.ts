/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Point3d } from "@itwin/core-geometry";
import { MeasurementToolModel } from "../api/MeasurementToolModel.js";
import type { AngleMeasurementFormattingProps } from "../measurements/AngleMeasurement.js";
import { AngleMeasurement } from "../measurements/AngleMeasurement.js";

enum State {
  SetMeasurementViewport,
  SetStartPoint,
  SetCenter,
  SetEndPoint,
}

/** Tool model for measuring radius using 3-points */
export class MeasureAngleToolModel extends MeasurementToolModel<AngleMeasurement> {
  public static State = State;

  private _currentMeasurement?: AngleMeasurement;
  private _currentViewportType?: string;
  private _currentState: State;
  private _formatting?: AngleMeasurementFormattingProps

  constructor() {
    super();
    this._currentState = State.SetMeasurementViewport;
  }

  public get formatting(): AngleMeasurementFormattingProps | undefined { return this._formatting; }
  public set formatting(formatting: AngleMeasurementFormattingProps | undefined) { this._formatting = formatting; }
  public get currentState(): State {
    return this._currentState;
  }

  public override get dynamicMeasurement(): AngleMeasurement | undefined {
    return this._currentMeasurement;
  }

  public setMeasurementViewport(viewType: string): boolean {
    if (State.SetMeasurementViewport !== this._currentState) return false;

    this._currentViewportType = viewType;
    this._moveToNextState();
    return true;
  }

  public setStartPoint(
    viewType: string,
    point: Point3d,
    isDynamic: boolean,
  ): boolean {
    if (State.SetStartPoint !== this._currentState) return false;

    if (viewType !== this._currentViewportType!) return false;

    this._currentMeasurement = AngleMeasurement.create(
      point,
      undefined,
      undefined,
      viewType,
      this._formatting
    );
    this._currentMeasurement.isDynamic = isDynamic;
    this.notifyNewMeasurement();
    this._moveToNextState();
    return true;
  }

  public setCenter(
    viewType: string,
    point: Point3d,
    isDynamic: boolean,
  ): boolean {
    if (State.SetCenter !== this._currentState) return false;
    if (viewType !== this._currentViewportType!) return false;

    this._currentMeasurement!.setCenter(point);
    this._currentMeasurement!.isDynamic = isDynamic;
    this.notifyDynamicMeasurementChanged();
    if (!isDynamic) this._moveToNextState();

    return true;
  }

  public setEndPoint(
    viewType: string,
    point: Point3d,
    isDynamic: boolean,
  ): boolean {
    if (State.SetEndPoint !== this._currentState) return false;
    if (viewType !== this._currentViewportType!) return false;

    this._currentMeasurement!.setEndPoint(point);
    this._currentMeasurement!.isDynamic = isDynamic;
    this.notifyDynamicMeasurementChanged();
    if (!isDynamic) this._moveToNextState();

    return true;
  }

  private _moveToNextState(): void {
    switch (this._currentState) {
      case State.SetMeasurementViewport:
        this._currentState = State.SetStartPoint;
        break;
      case State.SetStartPoint:
        this._currentState = State.SetCenter;
        break;
      case State.SetCenter:
        this._currentState = State.SetEndPoint;
        break;
      case State.SetEndPoint:
        this._currentMeasurement!.isDynamic = false;
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
