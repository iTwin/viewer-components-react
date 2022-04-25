/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Observable, Observer, of } from "rxjs";
import { catchError, map, tap } from "rxjs/operators";
import { plainToInstance } from "class-transformer";
import { find as _find, forEach as _forEach, map as _map } from "lodash";

import { EntityType } from "../../enums/entities/EntityTypeEnum";
import { Sensor } from "../../models/entities/SensorModel";
import { MetricCategory } from "../../models/observations/MetricCategoryModel";
import { Metric } from "../../models/observations/MetricModel";
import { Unit } from "../../models/observations/UnitModel";
import { ApiService } from "../api/ApiService";
import { EntityTypeService } from "../entities/EntityTypeService";
import { LoggerService } from "../LoggerService";

class MetricServiceSingleton {

  private endpoints = {
    getMetrics: "/api/sensors/metrics",
  };

  private metricCache = {
    sensors: { } as {[key: string]: MetricCategory[]},
    metrics: { } as {[key: string]: Metric},
    units: { } as {[key: string]: Unit},
  };

  // NOTE: although this method technically supports retrieval of metrics for multiple sensors,
  // it currently returns only the metrics for the first sensor, due to the complexity
  // of merging metric categories, metrics, units and metric params for a group of sensors
  public getMetrics$(sensorIds: string[], enableIPIMetricFilters = false): Observable<MetricCategory[]> {
    const cacheKey = `${sensorIds.join("-")}-${enableIPIMetricFilters.toString()}`;
    if (this.metricCache.sensors[cacheKey]) {
      return of(this.metricCache.sensors[cacheKey]);
    } else {
      const params: {[key: string]: string} = { categorized: "true" };
      if (enableIPIMetricFilters) {
        params.filters = "xy";
      }
      return ApiService.sendRequest$(
        this.endpoints.getMetrics,
        "POST",
        { params, data: {ids: sensorIds} }
      ).pipe(
        tap((data: any) => LoggerService.log("Received metrics:", data)),
        catchError(() => of([])),
        map((data: any) => {

          let firstSensorMetrics: MetricCategory[] = [];

          // Loop through all metrics and their units, cache them so we can
          // quickly retrieve their names (all this work for such a small thing)
          if (data.metricsBySensor) {
            _forEach(data.metricsBySensor, (rawCategories: any[]) => {
              const categories = plainToInstance(MetricCategory, rawCategories);
              if (!firstSensorMetrics.length) {
                firstSensorMetrics = categories;
              }
              _forEach(categories, (category: MetricCategory) => {
                _forEach(category.getMetrics(), (metric: Metric) => {
                  this.metricCache.metrics[metric.getId()] = metric;
                  _forEach(metric.getUnits(), (unit: Unit) => {
                    this.metricCache.units[unit.getId()] = unit;
                  });
                });
              });
            });
          }

          // Save metrics in cache so we don"t have to make this request again
          this.metricCache.sensors[cacheKey] = firstSensorMetrics;

          return firstSensorMetrics;
        })
      );
    }
  }

  public getDefaultMetricsForSensor$(sensor: Sensor, enableIPIMetricFilters = false): Observable<Metric[]> {
    return new Observable<Metric[]>((observer: Observer<Metric[]>) => {
      const sensorType = EntityTypeService.getType(EntityType.SENSOR, sensor.getType() as string);
      const defaultMetrics = sensorType.getDefaultMetrics();
      if (defaultMetrics.length) {
        observer.next(
          _map(defaultMetrics, (metric: {id: string, unit: string}) => new Metric(metric.id, metric.id, metric.unit))
        );
        observer.complete();
      } else {
        this.getMetrics$([sensor.getId()], enableIPIMetricFilters)
          .pipe(
            map((metricCategories: MetricCategory[]) => {
              const firstMetricCategory = _find(metricCategories, (c: MetricCategory) => !!c.getMetrics().length);
              if (firstMetricCategory) {
                return firstMetricCategory.getMetrics()[0];
              } else {
                return null;
              }
            })
          )
          .subscribe({
            next: (metric: Metric | null) => {
              if (metric) {
                observer.next([metric]);
                observer.complete();
              } else {
                observer.error({ code: "no-metrics-found" });
              }
            },
            error: (error: any) => observer.error(error),
          });
      }
    });
  }

  public primeMetricCache$(sensorId: string, metricId: string): Observable<MetricCategory[] | null> {
    return this.getMetric(metricId) ? of(null) : this.getMetrics$([sensorId]);
  }

  public getMetric(id: string): Metric {
    return this.metricCache.metrics[id];
  }

  public getUnit(id: string): Unit {
    return this.metricCache.units[id];
  }

}

export const MetricService: MetricServiceSingleton = new MetricServiceSingleton();
