/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Observer} from "rxjs";
import { combineLatest, Observable, of } from "rxjs";
import { distinctUntilChanged, finalize, map, shareReplay, switchMap, throttleTime } from "rxjs/operators";
import { instanceToPlain } from "class-transformer";
import { isEqual as _isEqual } from "lodash";

import { EntityType } from "../../enums/entities/EntityTypeEnum";
import type { SensorData } from "../../models/entities/SensorDataInterface";
import type { Alert } from "../../models/alerts/AlertModel";
import type { ObservationQuery } from "../../models/observations/ObservationQueryModel";
import type { ObservationQueryMetadata } from "../../models/observations/ObservationQueryMetadataModel";
import type { ObservationSet } from "../../models/observations/ObservationSetModel";
import type { IModelSettings } from "../../models/imodel/IModelSettingsModel";
import { EntityService } from "./EntityService";
import { AlertService } from "../alerts/AlertService";
import { MetricService } from "../observations/MetricService";
import { ObservationService } from "../observations/ObservationService";
import { IModelSettingsService } from "../imodel/IModelSettingsService";

export class EntityDataServiceSingleton {

  // Keep track and re-use sensor data observables to minimize data calls and subscriptions
  private sensorDataObservables: { [key: string]: Observable<SensorData> } = {};

  // Convenience method for retrieving all relevant sensor data in one call
  // Returns sensor object, alerts and last observation
  public getDataForSensor$(id: string): Observable<SensorData> {
    if (!this.sensorDataObservables[id]) {
      this.sensorDataObservables[id] = MetricService.getMetrics$([id])
        .pipe(
          switchMap(() => {
            return EntityService.getEntity$(EntityType.SENSOR, id)
              .pipe(
                switchMap((entity: any) => {
                  return combineLatest([
                    AlertService.getActiveAlertsForSensor$(id),
                    this.getObservationQueriesForSensor$(id)
                      .pipe(
                        switchMap((queries: ObservationQuery[]) => {
                          return ObservationService.getLastObservations$(entity, queries);
                        })
                      ),
                  ]).pipe(
                    map(([alerts, observations]: [Alert[], ObservationSet[]]) => {
                      return { sensor: entity, alerts, observations };
                    })
                  );
                })
              );
          }),
          throttleTime(1000, undefined, {leading: true, trailing: true}),
          finalize(() => {
            delete this.sensorDataObservables[id];
          }),
          shareReplay({
            bufferSize: 1,
            refCount: true,
          })
        );
    }

    return this.sensorDataObservables[id];
  }

  // Convenience method for retrieving all relevant data of the selected sensor
  // Returns sensor object, alerts and last observation
  public getDataForSelectedSensor$(): Observable<SensorData | undefined> {
    return this.getSelectedSensorId$()
      .pipe(
        switchMap((selectedEntityId: string | undefined) => {
          if (selectedEntityId) {
            return this.getDataForSensor$(selectedEntityId);
          } else {
            return of(undefined);
          }
        })
      );
  }

  // Convenience method for retrieving observations for selected sensor (for graphs)
  public getObservationsForSelectedSensor$(
    observationQueryMetadata?: ObservationQueryMetadata
  ): Observable<{loading: boolean, data: SensorData | undefined}> {
    return new Observable<{loading: boolean, data: SensorData | undefined}>(
      (observer: Observer<{loading: boolean, data: SensorData | undefined}>) => {

        // Subscribe to data for sensor, including new observations
        const dataSubscription = this.getSelectedSensorId$()
          .pipe(
            switchMap((selectedEntityId: string | undefined) => {
              if (selectedEntityId) {
                return EntityService.getEntity$(EntityType.SENSOR, selectedEntityId)
                  .pipe(
                    switchMap((entity: any) => {
                      return ObservationService.getFirstReadingDateForSensor$(selectedEntityId)
                        .pipe(
                          switchMap((firstReadingDate: string | undefined) => {
                            return this.getObservationQueriesForSensor$(
                              selectedEntityId,
                              true
                            ).pipe(
                              switchMap((queries: ObservationQuery[]) => {
                                observer.next({loading: true, data: undefined});
                                return ObservationService.getObservations$(
                                  entity,
                                  queries[0],
                                  observationQueryMetadata
                                ).pipe(
                                  map((observations: ObservationSet | null) => {
                                    return {
                                      sensor: entity,
                                      observations: observations ? [observations] : [],
                                      firstReadingDate,
                                    };
                                  })
                                );
                              })
                            );
                          })
                        );
                    })
                  );
              } else {
                return of(undefined);
              }
            })
          )
          .subscribe({
            next: (data: SensorData | undefined) => {
              observer.next({loading: false, data});
            },
            error: (error: any) => {
              observer.error(error);
            },
            complete: () => {
              observer.complete();
            },
          });

        // Make sur we close any outstanding data subscription when observable completes
        return () => {
          dataSubscription.unsubscribe();
        };
      }
    );
  }

  // Convenience method for subscribing to the currently selected sensor
  private getSelectedSensorId$(): Observable<string | undefined> {
    return IModelSettingsService.iModelSettings$()
      .pipe(
        map((iModelSettings: IModelSettings) => {
          return iModelSettings.getSelectedEntityId();
        }),
        distinctUntilChanged((p: string | undefined, c: string | undefined) => {
          return p === c;
        })
      );
  }

  // Convenience method for retrieving selected observations queries (metric, unit, params) for a given sensor
  private getObservationQueriesForSensor$(id: string, returnFirstQueryOnly = false): Observable<ObservationQuery[]> {
    return IModelSettingsService.iModelSettings$()
      .pipe(
        map((iModelSettings: IModelSettings) => {
          return iModelSettings.getAssociation(id)?.getObservationQueries() || [];
        }),
        distinctUntilChanged((p: ObservationQuery[], c: ObservationQuery[]) => {
          return _isEqual(
            instanceToPlain(returnFirstQueryOnly ? p[0] : p),
            instanceToPlain(returnFirstQueryOnly ? c[0] : c)
          );
        })
      );
  }

}

export const EntityDataService: EntityDataServiceSingleton = new EntityDataServiceSingleton();
