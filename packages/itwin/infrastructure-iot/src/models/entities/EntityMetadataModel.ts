/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export class EntityMetadata {

  private readonly deviceCount: number = 0;
  private readonly sensorCount: number = 0;
  private readonly observationCount: number = 0;

  public hasMetadata(): boolean {
    return !!(this.getDeviceCount() || this.getSensorCount() || this.getObservationCount());
  }

  public getDeviceCount(): number {
    return this.deviceCount;
  }

  public getSensorCount(): number {
    return this.sensorCount;
  }

  public getObservationCount(): number {
    return this.observationCount;
  }

}
