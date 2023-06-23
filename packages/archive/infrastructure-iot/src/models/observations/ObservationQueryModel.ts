/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Exclude } from "class-transformer";

export class ObservationQuery {

  private sensorIds: string[];

  @Exclude({ toPlainOnly: true })
  private metricCategory?: string;

  private metric?: string;
  private unit?: string;
  private metricParams: {[key: string]: any} = {};

  @Exclude({ toPlainOnly: true })
  private startDate?: string;

  @Exclude({ toPlainOnly: true })
  private endDate?: string;

  @Exclude({ toPlainOnly: true })
  private limitFunction?: "first" | "last";

  @Exclude({ toPlainOnly: true })
  private dataAveragingFunction?: "sub-sample" | "asap" | "moving_average";

  @Exclude({ toPlainOnly: true })
  private dataAveragingFunctionParams?: {[key: string]: any};

  constructor(
    sensorIds?: string[],
    metricCategory?: string,
    metric?: string,
    unit?: string,
    metricParams?: {[key: string]: any},
    startDate?: string,
    endDate?: string,
    limitFunction?: "first" | "last",
    dataAveragingFunction?: "sub-sample" | "asap" | "moving_average",
    dataAveragingFunctionParams?: {[key: string]: any}
  ) {
    this.sensorIds = sensorIds || [];
    this.metricCategory = metricCategory;
    this.metric = metric;
    this.unit = unit;
    this.metricParams = metricParams || {};
    this.startDate = startDate;
    this.endDate = endDate;
    this.limitFunction = limitFunction;
    this.dataAveragingFunction = dataAveragingFunction;
    this.dataAveragingFunctionParams = dataAveragingFunctionParams;
  }

  public getSensorIds(): string[] {
    return this.sensorIds;
  }

  public setSensorIds(sensorIds: string[]): void {
    this.sensorIds = sensorIds;
  }

  public getMetricCategory(): string | undefined {
    return this.metricCategory;
  }

  public setMetricCategory(metricCategory: string): void {
    this.metricCategory = metricCategory;
  }

  public getMetric(): string | undefined {
    return this.metric;
  }

  public setMetric(metric: string): void {
    this.metric = metric;
  }

  public getUnit(): string | undefined {
    return this.unit;
  }

  public setUnit(unit: string): void {
    this.unit = unit;
  }

  public getMetricParams(): {[key: string]: any} {
    return this.metricParams;
  }

  public getMetricParam(id: string): any {
    return this.metricParams[id];
  }

  public hasMetricParam(id: string): boolean {
    return !!this.metricParams[id];
  }

  public setMetricParams(metricParams: {[key: string]: any}): void {
    this.metricParams = metricParams;
  }

  public setMetricParam(id: string, value?: any): void {
    if (value) {
      this.metricParams[id] = value;
    } else {
      delete this.metricParams[id];
    }
  }

  public getStartDate(): string | undefined {
    return this.startDate;
  }

  public setStartDate(startDate?: string): void {
    this.startDate = startDate;
  }

  public getEndDate(): string | undefined {
    return this.endDate;
  }

  public setEndDate(endDate?: string): void {
    this.endDate = endDate;
  }

  public getLimitFunction(): {[key: string]: any} | undefined {
    if (this.limitFunction) {
      return {
        function: this.limitFunction,
        params: {
          size: 1,
        },
      };
    } else {
      return undefined;
    }
  }

  public setLimitFunction(limitFunction: "first" | "last"): void {
    this.limitFunction = limitFunction;
  }

  public getDataAveragingFunction(): {[key: string]: any} | undefined {
    if (this.dataAveragingFunction) {
      return {
        function: this.dataAveragingFunction,
        params: this.dataAveragingFunctionParams,
      };
    } else {
      return undefined;
    }
  }

  public setDataAveragingFunction(
    dataAveragingFunction: "sub-sample" | "asap" | "moving_average",
    dataAveragingFunctionParams?: {[key: string]: any}
  ): void {
    this.dataAveragingFunction = dataAveragingFunction;
    this.dataAveragingFunctionParams = dataAveragingFunctionParams || {};
  }

}
