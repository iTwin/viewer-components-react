/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Type } from "class-transformer";
import { orderBy as _orderBy } from "lodash";

import { ObservationQuery } from "./ObservationQueryModel";

export class ObservationSet {

  private readonly entityId?: string;
  private readonly entityName?: string;
  private readonly entityType?: string;
  private readonly entityTypeReadable?: string;

  private readonly metricId?: string;
  private readonly metricName?: string;
  private readonly unitId?: string;
  private readonly unitName?: string;

  @Type(() => ObservationQuery)
  private readonly observationQuery?: ObservationQuery;

  protected observations: any[] = [];

  public getEntityId(): string | undefined {
    return this.entityId;
  }

  public getEntityName(): string | undefined {
    return this.entityName;
  }

  public getEntityType(): string | undefined {
    return this.entityType;
  }

  public getEntityTypeReadable(): string | undefined {
    return this.entityTypeReadable;
  }

  public getMetricId(): string | undefined {
    return this.metricId;
  }

  public getMetricName(): string | undefined {
    return this.metricName;
  }

  public getUnitId(): string | undefined {
    return this.unitId;
  }

  public getUnitName(): string | undefined {
    return this.unitName;
  }

  public getObservationQuery(): ObservationQuery | undefined {
    return this.observationQuery;
  }

  public hasObservations(): boolean {
    return this.observations && this.observations.length > 0;
  }

  public getObservations(): any[] {
    return this.observations;
  }

  public setObservations(observations: any[]): void {
    this.observations = observations;
  }

  public sortObservations(): void {
    this.observations = _orderBy(this.observations, (observation: any) => {
      return observation[0];
    });
  }

  public addObservation(observation: any): void {
    this.observations.push(observation);
  }

}
