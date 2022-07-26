/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Point3d } from "@itwin/core-geometry";
import { MeasurementToolModel } from "../api/MeasurementToolModel";
import type { LocationMeasurementProps } from "../measurements/LocationMeasurement";
import { LocationMeasurement } from "../measurements/LocationMeasurement";
import type { MeasurementProps } from "../api/MeasurementProps";

// Properties of LocationMeasurementProps that are NOT inherited from MeasurementProps
// We don't want to expose anything from the MeasurementProps for addLocation
type LocationMeasurementPropsOnly = Omit<LocationMeasurementProps, keyof MeasurementProps>;

// We want 'location' to be a Point3d, not a XYZProps
export interface AddLocationProps extends Omit<LocationMeasurementPropsOnly, "location"> {
  location: Point3d;
  viewType: string;
}

export class MeasureLocationToolModel extends MeasurementToolModel<LocationMeasurement> {
  private _currentMeasurement?: LocationMeasurement;

  public override get dynamicMeasurement(): LocationMeasurement | undefined { return this._currentMeasurement; }

  constructor() {
    super();
  }

  public addLocation(props: AddLocationProps, isDynamic: boolean): void {
    const { viewType, ...rest } = props;

    if (!this._currentMeasurement) {
      this._currentMeasurement = new LocationMeasurement(rest);
      this._currentMeasurement.viewTarget.include(viewType);
      this._currentMeasurement.isDynamic = isDynamic;
      this.notifyNewMeasurement();
    } else {
      this._currentMeasurement.changeLocation(props);
      this.notifyDynamicMeasurementChanged();
    }

    if (isDynamic)
      return;

    this._currentMeasurement.isDynamic = false;
    this.addMeasurementAndReset(this._currentMeasurement);
  }

  public override reset(clearMeasurements: boolean): void {
    super.reset(clearMeasurements);
    this._currentMeasurement = undefined;
  }
}
