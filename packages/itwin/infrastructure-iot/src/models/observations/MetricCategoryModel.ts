/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Type } from "class-transformer";

import { Metric } from "./MetricModel";

export class MetricCategory {

  private readonly metricCategoryId: string;
  private readonly metricCategory: string;

  @Type(() => Metric)
  private readonly metrics: Metric[] = [];

  constructor(id: string, name: string) {
    this.metricCategoryId = id;
    this.metricCategory = name;
  }

  public getId(): string {
    return this.metricCategoryId;
  }

  public getName(): string {
    return this.metricCategory;
  }

  public getMetrics(): Metric[] {
    return this.metrics;
  }

}
