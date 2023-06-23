/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export class Unit {

  private readonly id: string;
  private readonly notation: string;

  constructor(id: string, notation: string) {
    this.id = id;
    this.notation = notation;
  }

  public getId(): string {
    return this.id;
  }

  public getName(): string {
    return this.id === "UNITLESS" ? "" : this.notation;
  }

}
