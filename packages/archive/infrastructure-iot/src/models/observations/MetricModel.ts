/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Type } from "class-transformer";
import { orderBy as _orderBy } from "lodash";

import { Unit } from "./UnitModel";

export class Metric {

  private readonly id: string;
  private readonly displayName: string;
  private readonly defaultUnit: string;
  private readonly params: { id: string }[] = [];

  @Type(() => Unit)
  private readonly units: Unit[] = [];

  constructor(id: string, displayName: string, defaultUnit: string) {
    this.id = id;
    this.displayName = displayName;
    this.defaultUnit = defaultUnit;
  }

  public getId(): string {
    return this.id;
  }

  public getName(): string {
    return this.displayName;
  }

  public isUnitless(): boolean {
    return this.units.length === 1 && this.units[0].getId() === "UNITLESS";
  }

  public getDefaultUnit(): string {
    return this.defaultUnit;
  }

  public getUnits(): Unit[] {
    return _orderBy(this.units, (unit: Unit) => unit.getId());
  }

  public hasMetricParams(): boolean {
    return !!this.getMetricParams().length;
  }

  public getMetricParams(): { id: string }[] {
    return _orderBy(this.params, (param: { id: string }) => param.id);
  }

}
