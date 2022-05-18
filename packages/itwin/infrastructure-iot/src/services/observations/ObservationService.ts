/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Observer} from "rxjs";
import { combineLatest, Observable, of } from "rxjs";
import { catchError, first, map, startWith, switchMap, tap } from "rxjs/operators";
import { plainToInstance } from "class-transformer";
import { cloneDeep as _cloneDeep, compact as _compact, forEach as _forEach, has as _has, map as _map } from "lodash";
import moment from "moment";

import { ObservationQuery } from "../../models/observations/ObservationQueryModel";
import type { ObservationQueryMetadata } from "../../models/observations/ObservationQueryMetadataModel";
import { ObservationSet } from "../../models/observations/ObservationSetModel";
import type { Metric } from "../../models/observations/MetricModel";
import type { Sensor } from "../../models/entities/SensorModel";
import { SocketService } from "../api/SocketService";
import { EntityTypeService } from "../entities/EntityTypeService";
import { MetricService } from "./MetricService";
import { LoggerService } from "../LoggerService";

class ObservationServiceSingleton {

  private socketEndpoints = {
    getObservations: "getData",
    getObservationSummary: "getObservationsSummary",
    subscribeToNewObservations: "subscribeData",
    unsubscribeFromNewObservations: "unsubscribeData",
  };

  private firstsReadingDateCache: {[key: string]: string | undefined} = {};

  public getObservations$(
    sensor: Sensor,
    observationQuery?: ObservationQuery,
    observationQueryMetadata?: ObservationQueryMetadata
  ): Observable<ObservationSet | null> {
    return this.getObservationsForSensor$(sensor, observationQuery, observationQueryMetadata);
  }

  public getLastObservations$(entity: Sensor, observationQueries?: ObservationQuery[]): Observable<ObservationSet[]> {

    // For sensors, load all observations as specified in the passed query array
    // Or fall back to sensor's first default metric
    if (observationQueries && observationQueries.length) {
      return MetricService.primeMetricCache$(entity.getId(), observationQueries[0].getMetric() as string)
        .pipe(
          switchMap(() => {
            return combineLatest(
              _map(observationQueries, (query: ObservationQuery) => {
                return this.getObservationsForSensor$(
                  entity,
                  query,
                  undefined,
                  true
                );
              })
            ).pipe(
              map((observationSets: (ObservationSet | null)[]) => {
                return _compact(observationSets);
              })
            );
          })
        );
    } else {
      return this.getObservationsForSensor$(
        entity,
        undefined,
        undefined,
        true
      ).pipe(
        map((observationSet: ObservationSet | null) => {
          return observationSet ? [observationSet] : [];
        })
      );
    }
  }

  public getFirstReadingDateForSensor$(sensorId: string): Observable<string | undefined> {
    if (_has(this.firstsReadingDateCache, sensorId)) {
      return of(this.firstsReadingDateCache[sensorId]);
    } else {
      return SocketService.send$(this.socketEndpoints.getObservationSummary, {
        sensors: [sensorId],
      }).pipe(
        first(),
        tap((data: any) => LoggerService.log("Received observation summary for sensor:", data)),
        map((observationSummary: any) => {

          // Loop through all sensors in the result and
          // return the earliest date out of all sensor readings
          let firstReadingDate: Date | undefined;
          _forEach(observationSummary, (sensorStats: any) => {
            if (sensorStats.first && sensorStats.first.observations) {
              const sensorFirstReadingDate = new Date(Date.parse(Object.keys(sensorStats.first.observations)[0]));
              if (!firstReadingDate || firstReadingDate.getTime() > sensorFirstReadingDate.getTime()) {
                firstReadingDate = sensorFirstReadingDate;
              }
            }
          });

          // Save date in cache to reduce future requests
          this.firstsReadingDateCache[sensorId] = firstReadingDate ? firstReadingDate.toISOString() : undefined;

          // Return the first reading date
          return this.firstsReadingDateCache[sensorId];
        })
      );
    }
  }

  private getObservationsForSensor$(
    sensor: Sensor,
    observationQuery?: ObservationQuery,
    observationQueryMetadata?: ObservationQueryMetadata,
    getLastObservationOnly = false
  ): Observable<ObservationSet | null> {

    // If observation query was provided, use that, otherwise retrieve default metric for sensor
    let queryObservable: Observable<ObservationQuery>;
    if (observationQuery) {
      queryObservable = of(observationQuery);
    } else {
      queryObservable = MetricService.getDefaultMetricsForSensor$(sensor)
        .pipe(
          map((metrics: Metric[]) => {
            return new ObservationQuery(
              [sensor.getId()],
              undefined,
              metrics[0].getId(),
              metrics[0].getDefaultUnit()
            );
          })
        );
    }

    // Subscribe to observation query we should use for this operation
    // Then return the observation sets with the data
    return queryObservable
      .pipe(
        switchMap((query: ObservationQuery) => {

          // For last observation queries, set appropriate limit function
          if (getLastObservationOnly) {
            query.setLimitFunction("last");
          }

          // Add query metadata, if supplied
          if (observationQueryMetadata) {
            query.setStartDate(observationQueryMetadata.getStartDate());
            query.setDataAveragingFunction(
              "sub-sample",
              {
                resolution: observationQueryMetadata.getWindowResolution(),
              }
            );
          }

          // Return sensor data observable, which includes an initial get
          // as well as a subscription to new observations
          return this.getAllObservationsForSensor$(sensor, query)
            .pipe(
              switchMap((observationSet: ObservationSet) => {
                return this.subscribeToNewObservationsForSensor$(sensor, query)
                  .pipe(
                    map((updatedObservationSet: ObservationSet) => {
                      if (observationSet.getObservationQuery()?.getStartDate()) {
                        const newObservations = observationSet.getObservations()
                          .concat(updatedObservationSet.getObservations());
                        updatedObservationSet.setObservations(newObservations);
                      }
                      return updatedObservationSet;
                    }),
                    startWith(observationSet)
                  );
              })
            );
        }),
        catchError(() => {
          return of(null);
        })
      );
  }

  private getAllObservationsForSensor$(sensor: Sensor, observationQuery: ObservationQuery): Observable<ObservationSet> {
    return new Observable<ObservationSet>((observer: Observer<ObservationSet>) => {

      let observationSet: ObservationSet;

      // We first need to prime the metrics cache so we have
      // metric metadata, then proceed to observation retrieval
      MetricService.primeMetricCache$(sensor.getId(), observationQuery.getMetric() as string)
        .pipe(
          switchMap(() => {
            observationSet = this.createObservationSet(sensor, observationQuery);
            return SocketService.send$(this.socketEndpoints.getObservations, {
              sensor: sensor.getId(),
              metric: observationQuery.getMetric(),
              unit: observationQuery.getUnit(),
              params: this.getMetricParamsForQuery(observationQuery),
              startDate: observationQuery.getStartDate(),
              endDate: observationQuery.getEndDate(),
              limit: observationQuery.getLimitFunction(),
              smoothing: observationQuery.getDataAveragingFunction(),
            }).pipe(
              startWith({}),
              tap((data: any) => {
                if (data.data) {
                  _forEach(data.data, (value: number, date: string) => {
                    observationSet.addObservation([Date.parse(date), value]);
                  });
                }
              })
            );
          })
        )
        .subscribe({
          error: () => {
            observer.next(this.createObservationSet(sensor, observationQuery));
            observer.complete();
          },
          complete: () => {
            observationSet.sortObservations();
            LoggerService.log("Received observations:", observationSet);
            observer.next(observationSet);
            observer.complete();
          },
        });
    });
  }

  private subscribeToNewObservationsForSensor$(sensor: Sensor, observationQuery: ObservationQuery): Observable<ObservationSet> {
    return SocketService.send$(
      this.socketEndpoints.subscribeToNewObservations,
      {
        sensors: [sensor.getId()],
        metric: observationQuery.getMetric(),
        unit: observationQuery.getUnit(),
        params: this.getMetricParamsForQuery(observationQuery),
      },
      this.socketEndpoints.unsubscribeFromNewObservations
    ).pipe(
      // tap((data: any) => LoggerService.log("Received new observations:", data)),
      map((data: any) => {
        const observationSet = this.createObservationSet(sensor, observationQuery);
        if (data.data) {
          _forEach(data.data, (value: number, date: string) => {
            observationSet.addObservation([Date.parse(date), value]);
          });
        }
        observationSet.sortObservations();
        return observationSet;
      })
    );
  }

  // Correction for delta-like metrics - add START_DATE param of one week ago
  // This is done so delta-like metrics don"t return a 0 with no reference params specified
  private getMetricParamsForQuery(observationQuery: ObservationQuery): {[key: string]: any} {
    const metricParams = _cloneDeep(observationQuery.getMetricParams());
    const startDate = observationQuery.getStartDate() || moment().subtract(1, "week").toISOString();
    metricParams.START_DATE = { value: startDate };
    return metricParams;
  }

  private createObservationSet(entity: Sensor, observationQuery: ObservationQuery): ObservationSet {
    const metric = MetricService.getMetric(observationQuery.getMetric() as string);
    const unit = MetricService.getUnit(observationQuery.getUnit() as string);
    const observationSet = {
      entityId: entity.getId(),
      entityName: entity.getName(),
      entityType: entity.getType(),
      entityTypeReadable: entity.isSensor() ? EntityTypeService.getSensorTypeReadable(entity) : undefined,
      metricId: observationQuery.getMetric(),
      metricName: metric ? metric.getName() : observationQuery.getMetric(),
      unitId: observationQuery.getUnit(),
      unitName: unit ? unit.getName() : observationQuery.getUnit(),
      observationQuery,
      observations: [],
    };
    return plainToInstance(ObservationSet, observationSet);
  }

}

export const ObservationService: ObservationServiceSingleton = new ObservationServiceSingleton();
