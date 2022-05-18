/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { XYAndZ } from "@itwin/core-geometry";

import type { ObservationQuery } from "../observations/ObservationQueryModel";

export class IModelEntityAssociation {

  constructor(
    private entityId: string,
    private associationMethod: "element",
    private elementId?: string,
    private elementName?: string,
    private elementOrigin?: XYAndZ,
    private observationQueries: ObservationQuery[] = []
  ) {}

  public getEntityId(): string {
    return this.entityId;
  }

  public getElementId(): string | undefined {
    return this.elementId;
  }

  public setElementId(elementId: string): void {
    if (elementId !== this.elementId) {
      this.elementId = elementId;
      this.elementName = undefined;
      this.elementOrigin = undefined;
    }
  }

  public getElementName(): string | undefined {
    return this.elementName || this.elementId;
  }

  public getElementOrigin(): XYAndZ | undefined {
    return this.elementOrigin;
  }

  public getObservationQueries(): ObservationQuery[] {
    return this.observationQueries;
  }

  public setObservationQueries(observationQueries: ObservationQuery[]): void {
    this.observationQueries = observationQueries;
  }

  public setObservationQuery(index: number, observationQuery: ObservationQuery): void {
    this.observationQueries[index] = observationQuery;
  }

  public addObservationQuery(observationQuery: ObservationQuery): void {
    this.observationQueries.push(observationQuery);
  }

  public deleteObservationQuery(index: number): void {
    this.observationQueries.splice(index, 1);
  }

  public getFirstObservationQuery(): ObservationQuery | undefined {
    return this.observationQueries[0];
  }

  public setFirstObservationQuery(observationQueries: ObservationQuery): void {
    this.observationQueries = [observationQueries];
  }

}
