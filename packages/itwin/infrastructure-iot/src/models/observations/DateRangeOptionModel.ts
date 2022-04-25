/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export class DateRangeOption {

  constructor(
    private label: string,
    private rangeSpan: {[key: string]: number}|null
  ) {}

  public getLabel(): string {
    return this.label;
  }

  public getRangeSpan(): object|null {
    return this.rangeSpan;
  }
}
