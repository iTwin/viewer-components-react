/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Point2d, Point3d } from "@itwin/core-geometry";
import { MeasurementPreferences } from "../api/MeasurementPreferences";
import { MeasurementToolModel } from "../api/MeasurementToolModel";
import { DistanceMeasurement } from "../measurements/DistanceMeasurement";

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

  private _firstPointDrawingId?: string;
  private _drawingOrigin?: Point2d;
  private _drawingExtents?: Point2d;

  constructor() {
    super();
    this._currentState = State.SetMeasurementViewport;
  }

  public get currentState(): State { return this._currentState; }

  public override get dynamicMeasurement(): DistanceMeasurement | undefined { return this._currentMeasurement; }

  public get firstPointDrawingId(): string | undefined {
    return this._firstPointDrawingId;
  }

  public set firstPointDrawingId(newId: string | undefined) {
    this._firstPointDrawingId = newId;
  }

  public get drawingExtents(): Point2d | undefined {
    return this._drawingExtents;
  }

  public set drawingExtents(extents: Point2d | undefined) {
    this._drawingExtents = extents;
  }

  public get drawingOrigin(): Point2d | undefined {
    return this._drawingOrigin;
  }

  public set drawingOrigin(origin: Point2d | undefined) {
    this._drawingOrigin = origin;
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

  public setSheetToWorldScale(scale: number | undefined) {
    this._currentMeasurement?.setSheetToWorldScale(scale);
  }

  public setStartPoint(viewType: string, point: Point3d): boolean {
    if (State.SetStartPoint !== this._currentState)
      return false;

    if (viewType !== this._currentViewportType!)
      return false;

    this._currentMeasurement = DistanceMeasurement.create(point, point, this._currentViewportType);
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
