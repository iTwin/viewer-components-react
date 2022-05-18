/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Observable} from "rxjs";
import { of } from "rxjs";
import { catchError, filter, map, shareReplay, startWith, switchMap, tap, throttleTime } from "rxjs/operators";
import { plainToInstance } from "class-transformer";
import { chain as _chain, forEach as _forEach, map as _map } from "lodash";
import moment from "moment";

import { AlertType } from "../../enums/alerts/AlertTypeEnum";
import type { AccessLevel } from "../../enums/AccessLevelEnum";
import { Alert } from "../../models/alerts/AlertModel";
import { AlertTrigger } from "../../models/alerts/AlertTriggerModel";
import { AlertPriorityMetadata } from "../../models/alerts/AlertPriorityMetadataModel";
import { ApiService } from "../api/ApiService";
import { SocketService } from "../api/SocketService";
import { MetricService } from "../observations/MetricService";
import { PermissionService } from "../PermissionService";
import { UtilitiesService } from "../UtilitiesService";
import { LoggerService } from "../LoggerService";

class AlertServiceSingleton {

  private alertTriggersSubscription?: Observable<any>;

  private endpoints = {
    getAlerts: "/api/alerts/triggers",
    getAlert: "/api/alerts/",
    acknowledgeAlerts: "/api/alerts/acknowledge",
    snoozeAlerts: "/api/alerts/snooze",
    setAlertState: "/api/alerts/state",
  };

  private socketEndpoints = {
    subscribeAlertTriggers: "subscribeAlertTriggers",
  };

  public getActiveAlertsForSensor$(sensorId: string): Observable<Alert[]> {
    return this.subscribeToAlertChangesForSensor$(sensorId)
      .pipe(
        startWith(void 0),
        switchMap(() => {
          return this.getAlerts$(sensorId)
            .pipe(
              catchError(() => of([])),
              map((alerts: Alert[]) => {
                return _chain(alerts)
                  .filter((alert: Alert) => {
                    const lastTrigger = alert.getLastTrigger();
                    return lastTrigger ? lastTrigger.isActive() : false;
                  })
                  .orderBy((alert: Alert) => {
                    return AlertPriorityMetadata.getMetadata(alert.getPriority()).priority;
                  }, ["desc"])
                  .value();
              }),
              switchMap((alerts: Alert[]) => {
                const alertIds = _map(alerts, (a: Alert) => a.getId());
                if (alertIds.length) {
                  return PermissionService.getPermissions$("alert", alertIds)
                    .pipe(
                      map((permissions: {[key: string]: AccessLevel}) => {
                        _forEach(alerts, (a: Alert) => {
                          if (permissions[a.getId()]) {
                            a.setAccessLevel(permissions[a.getId()]);
                          }
                        });
                        return alerts;
                      })
                    );
                } else {
                  return of(alerts);
                }
              })
            );
        })
      );
  }

  private getAlerts$(sensorId: string): Observable<Alert[]> {
    return ApiService.sendRequest$(
      this.endpoints.getAlerts,
      "GET",
      { params: { entityId: sensorId } }
    ).pipe(
      tap((data: any) => LoggerService.log("Received alerts for sensor:", data)),
      map((data: {alerts: object[]}) => {
        const alerts: Alert[] = [];
        if (data.alerts && data.alerts.length) {
          _forEach(data.alerts, (alertData: {[key: string]: any}) => {
            if (alertData.alert) {
              const alert: Alert = plainToInstance(Alert, alertData.alert as object);
              if (alertData.lastTrigger) {
                const trigger: AlertTrigger = plainToInstance(AlertTrigger, alertData.lastTrigger as object);
                this.setTriggerDescription(trigger);
                alert.setLastTrigger(trigger);
              }
              alerts.push(alert);
            }
          });
        }
        return alerts;
      })
    );
  }

  private subscribeToAlertChangesForSensor$(sensorId: string): Observable<void> {

    // First, check if we need to set up a global alert triggers subscription
    if (!this.alertTriggersSubscription) {
      this.alertTriggersSubscription = SocketService.send$(this.socketEndpoints.subscribeAlertTriggers)
        .pipe(
          // tap((data: any) => LoggerService.log("Received new alert triggers:", data)),
          shareReplay(0)
        );
    }

    // Next, return an Observable that filters the global alert trigger subscription based on current sensorId
    return this.alertTriggersSubscription.pipe(
      filter((data: any) => {

        let triggerForCurrentSensor = false;

        // Status alert trigger check
        if (data.entities && data.entities.includes(sensorId)) {
          triggerForCurrentSensor = true;
        }

        // Data alert trigger check
        if (data.context && !triggerForCurrentSensor) {
          _forEach(data.context, (trigger: any) => {
            if (trigger.sensorId === sensorId) {
              triggerForCurrentSensor = true;
            }
          });
        }

        return triggerForCurrentSensor;
      }),
      map(() => void 0),
      throttleTime(1000, undefined, {leading: true, trailing: true})
    );
  }

  private getAlert$(id: string): Observable<Alert> {
    return ApiService.sendRequest$(this.endpoints.getAlert + id)
      .pipe(
        tap((data: any) => LoggerService.log("Received alert:", data)),
        map((data: object) => plainToInstance(Alert, data))
      );
  }

  public acknowledgeAlerts$(alertIds: string[]): Observable<any> {
    return ApiService
      .sendRequest$(this.endpoints.acknowledgeAlerts, "PATCH", { data: { alertIds }})
      .pipe(tap(() => LoggerService.log("Acknowledged alerts:", alertIds)));
  }

  public snoozeAlerts$(alertIds: string[], wakeUpDateStr: string = moment().add(1, "hour").toISOString()): Observable<any> {
    return ApiService
      .sendRequest$(this.endpoints.snoozeAlerts, "PATCH", { data: { alertIds, wakeUpDateStr }})
      .pipe(tap(() => LoggerService.log("Snoozed alerts:", alertIds)));
  }

  public disableAlerts$(alertIds: string[]): Observable<any> {
    return this.setAlertState$(alertIds, false);
  }

  public enableAlerts$(alertIds: string[]): Observable<any> {
    return this.setAlertState$(alertIds, true);
  }

  private setAlertState$(alertIds: string[], enable: boolean): Observable<any> {
    return ApiService
      .sendRequest$(this.endpoints.setAlertState, "PATCH", { data: { alertIds, enable }})
      .pipe(tap(() => LoggerService.log("Set alert state:", { alertIds, enable })));
  }

  private setTriggerDescription(trigger: AlertTrigger): void {
    let description = "";
    const descriptionFields = trigger.getDescriptionFields();
    if (trigger.getType() === AlertType.DATA) {
      if (descriptionFields.context.length) {
        const value = UtilitiesService.formatNumericalValue(descriptionFields.context[0].value);
        const unitId = descriptionFields.context[0].rule.unit;
        const unitName = MetricService.getUnit(unitId)?.getName() || unitId;
        const metricId = descriptionFields.context[0].rule.metric;
        const metricName = MetricService.getMetric(metricId)?.getName() || metricId;
        description += `${value} ${unitName} (${metricName})`;
      }
    } else {
      description = "Has not reported in ";
      switch (descriptionFields.duration) {
        case 600:
          description += "10 Minutes";
          break;
        case 1800:
          description += "30 Minutes";
          break;
        case 5400:
          description += "1.5 Hours";
          break;
        case 14400:
          description += "4 Hours";
          break;
        case 43200:
          description += "12 Hours";
          break;
        case 129600:
          description += "1.5 Days";
          break;
        case 345600:
          description += "4 Days";
          break;
        default:
          description += UtilitiesService.formatNumericalValue(descriptionFields.duration / 60, 0);
          break;
      }
    }
    trigger.setDescription(description);
  }

}

export const AlertService: AlertServiceSingleton = new AlertServiceSingleton();
