/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Point3d } from "@itwin/core-geometry";
import { MeasurementPreferences } from "../api/MeasurementPreferences";
import { MeasurementToolModel } from "../api/MeasurementToolModel";
import { PerpendicularDistanceMeasurement } from "../measurements/PerpendicularDistanceMeasurement";
import type { DrawingMetadata } from "../api/Measurement";

enum State {
  SetMeasurementViewport,
  SetStartPoint,
  SetEndPoint,
}

export class MeasurePerpendicularDistanceToolModel extends MeasurementToolModel<PerpendicularDistanceMeasurement> {
  public static State = State;

  private _currentState: State;
  private _currentViewportType?: string;
  private _currentMeasurement?: PerpendicularDistanceMeasurement;

  constructor() {
    super();
    this._currentState = State.SetMeasurementViewport;
  }

  public get currentState(): State {
    return this._currentState;
  }

  public override get dynamicMeasurement(): PerpendicularDistanceMeasurement | undefined {
    return this._currentMeasurement;
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

  public setMeasurementViewport(viewType: string): boolean {
    if (State.SetMeasurementViewport !== this._currentState) return false;

    this._currentViewportType = viewType;
    this.moveToNextState();
    return true;
  }

  public setStartPoint(viewType: string, point: Point3d): boolean {
    if (this.currentState === State.SetMeasurementViewport) {
      return false;
    }

    if (viewType !== this._currentViewportType!) {
      return false;
    }

    if (this._currentState === State.SetStartPoint) {
      this._currentMeasurement = PerpendicularDistanceMeasurement.create(point, point, this._currentViewportType);
      this._currentMeasurement.isDynamic = true;
      this._currentMeasurement.showAxes = false; // Turn off axes for new dynamic measurements
      this.notifyNewMeasurement();
      this.moveToNextState();
    } else if (this._currentState === State.SetEndPoint && this._currentMeasurement) {
      this._currentMeasurement.setStartPoint(point);
    }

    return true;
  }

  public setEndPoint(viewType: string, point: Point3d, isDynamic: boolean, customStartPoint?: Point3d): boolean {
    if (State.SetEndPoint !== this._currentState) return false;

    if (viewType !== this._currentViewportType!) return false;

    this._currentMeasurement!.setEndPoint(point, customStartPoint);
    this.notifyDynamicMeasurementChanged();
    if (!isDynamic) this.moveToNextState();

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
