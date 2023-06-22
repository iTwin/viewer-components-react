/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export class DateRangeOption {

  constructor(
    private label: string,
    private rangeSpan: { value: number, unit: "hour" | "day" | "week" | "month" | "year" } | null
  ) {}

  public getLabel(): string {
    return this.label;
  }

  public getRangeSpan(): { value: number, unit: "hour" | "day" | "week" | "month" | "year" } | null {
    return this.rangeSpan;
  }

}
