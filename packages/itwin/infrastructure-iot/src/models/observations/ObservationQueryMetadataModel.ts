/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export class ObservationQueryMetadata {

  constructor(
    private startDate?: string,
    private windowResolution?: number
  ) { }

  public getStartDate(): string | undefined {
    return this.startDate;
  }

  public getWindowResolution(): number | undefined {
    return this.windowResolution;
  }

}
