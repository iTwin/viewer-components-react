/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import React, { useEffect, useRef, useState } from "react";

import { Icon } from "@itwin/core-react";
import { Button, IconButton, ProgressRadial, Tooltip, useTheme } from "@itwin/itwinui-react";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority } from "@itwin/core-frontend";

import { finalize, map } from "rxjs/operators";

import { EntityType } from "../../enums/entities/EntityTypeEnum";
import { AlertType } from "../../enums/alerts/AlertTypeEnum";
import type { SensorData } from "../../models/entities/SensorDataInterface";
import type { Sensor } from "../../models/entities/SensorModel";
import type { Alert } from "../../models/alerts/AlertModel";
import { AlertPriorityMetadata } from "../../models/alerts/AlertPriorityMetadataModel";
import { ObservationQuery } from "../../models/observations/ObservationQueryModel";
import type { ObservationSet } from "../../models/observations/ObservationSetModel";
import type { Metric } from "../../models/observations/MetricModel";
import type { AuthState } from "../../models/auth/AuthStateModel";

import { AuthService } from "../../services/AuthService";
import { EntityService } from "../../services/entities/EntityService";
import { EntityDataService } from "../../services/entities/EntityDataService";
import { EntityTypeService } from "../../services/entities/EntityTypeService";
import { IModelSettingsService } from "../../services/imodel/IModelSettingsService";
import { UtilitiesService } from "../../services/UtilitiesService";
import { MetricService } from "../../services/observations/MetricService";
import { AlertService } from "../../services/alerts/AlertService";

import { ExpandableBlockWrapper } from "../partials/ExpandableBlockWrapper";
import { MetricSelectForm } from "../partials/MetricSelectForm";

import appStyles from "../../styles/App.module.scss";
import styles from "./DeviceDataWidget.module.scss";

export function DeviceDataWidget() {

  // This is needed to iTwin React component to respect system-wide light/dark mode
  useTheme("os");

  const [canSave, setCanSave] = useState<boolean>(false);
  useEffect(() => {

    // Subscribe to auth state changes, show welcome screen or actual widget content
    const authStateSubscription = AuthService
      .authState$()
      .subscribe((authState: AuthState| null) => {
        if (authState) {
          setCanSave(authState.hasSettingsWriteAccess());
        }
      });

    return () => authStateSubscription.unsubscribe();
  }, []);

  // Subscribe to data of the selected sensor
  const [sensorData, setSensorData] = useState<SensorData | undefined>(undefined);
  const [observationQueryIndex, setObservationQueryIndex] = useState<number>(0);
  const obsQueryCount = useRef<number>(0);
  const sensorId = useRef<string | undefined>(undefined);
  useEffect(() => {
    const dataSubscription = EntityDataService
      .getDataForSelectedSensor$()
      .subscribe({
        next: (data: SensorData | undefined) => {
          if (data && data.observations) {

            const id: string = data.sensor.getId();
            const newCount: number = data.observations.length;

            // Reset metric selection when switching sensors
            if (sensorId.current !== id) {
              obsQueryCount.current = 0;
              setObservationQueryIndex(0);
            }
            sensorId.current = id;

            // Select newly added metric
            if (obsQueryCount.current && newCount > obsQueryCount.current) {
              setObservationQueryIndex(newCount - 1);
            }
            obsQueryCount.current = newCount;
          }
          setSensorData(data);
        },
        error: () => {},
      });
    return () => {
      dataSubscription.unsubscribe();
    };
  }, [observationQueryIndex]);

  // Open external link for sensor and control loading spinner state
  const [entityLinkOpenInProgress, setEntityLinkOpenInProgress] = useState<boolean>(false);
  const openExternalEntityUrl = () => {
    setEntityLinkOpenInProgress(true);
    EntityService.openExternalEntityUrl$(sensorData?.sensor as Sensor)
      .pipe(finalize(() => setEntityLinkOpenInProgress(false)))
      .subscribe({
        error: () => {
          const sensorName = sensorData?.sensor.getName();
          IModelApp
            .notifications
            .outputMessage(
              new NotifyMessageDetails(
                OutputMessagePriority.Warning,
                `Unable to open configuration page for sensor "${sensorName}". Please try again later.`
              )
            );
        },
      });
  };

  const addMetric = (data: SensorData) => {
    MetricService
      .getDefaultMetricsForSensor$(data.sensor)
      .pipe(
        map((metrics: Metric[]) => {
          const sensorId: string = data.sensor.getId();
          IModelSettingsService.addEntityObservationQuery(sensorId, new ObservationQuery(
            [sensorId],
            undefined,
            metrics[0].getId(),
            metrics[0].getDefaultUnit()
          ));
        })
      ).subscribe();
  };

  const editMetric = (index: number) => setObservationQueryIndex(index);

  const deleteMetric = (data: SensorData, index: number) => {

    // on last metric
    if (obsQueryCount.current - 1 === observationQueryIndex) {
      setObservationQueryIndex(observationQueryIndex - 1);
    }

    // select first metric if user deletes current metric
    if (index === observationQueryIndex) {
      setObservationQueryIndex(0);
    }

    IModelSettingsService.deleteEntityObservationQuery(data.sensor.getId(), index);
  };

  const [alertActionInProgress, setAlertActionInProgress] = useState<number | null>(null);
  const onAlertAction = (alert: Alert, alertIndex: number, action: "acknowledge" | "snooze" | "disable") => {
    setAlertActionInProgress(alertIndex);

    const onFinalize = () => setAlertActionInProgress(null);

    const showToast = (toastMsg: string) => IModelApp
      .notifications
      .outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, toastMsg));

    const onError = () => IModelApp
      .notifications
      .outputMessage(
        new NotifyMessageDetails(
          OutputMessagePriority.Warning,
          `Unable to ${action} IoT alert "${alert.getName()}". Please try again later.`
        )
      );

    switch (action) {
      case "acknowledge":
        AlertService
          .acknowledgeAlerts$([alert.getId()])
          .subscribe({
            next: (response: any) => {
              if (
                alert.getType() === AlertType.STATUS &&
                response.notAcknowledgedIds &&
                response.notAcknowledgedIds.includes(alert.getId())
              ) {
                IModelApp
                  .notifications
                  .outputMessage(
                    new NotifyMessageDetails(
                      OutputMessagePriority.Warning,
                      `Unable to acknowledge IoT alert "${alert.getName()}" because it will immediately re-trigger.`
                    )
                  );
              } else {
                showToast(`IoT alert "${alert.getName()}" was acknowledged.`);
              }
            },
            error: onError,
          }).add(() => onFinalize());
        break;
      case "snooze":
        AlertService
          .snoozeAlerts$([alert.getId()])
          .subscribe({
            next: () => showToast(`IoT alert "${alert.getName()}" was snoozed for 1 hour.`),
            error: onError,
          })
          .add(() => onFinalize());
        break;
      case "disable":
        AlertService
          .disableAlerts$([alert.getId()])
          .subscribe({
            next: () => showToast(`IoT alert "${alert.getName()}" was disabled.`),
            error: onError,
          })
          .add(() => onFinalize());
        break;
    }
  };

  return (
    <div className={appStyles["widget-wrapper"]}>
      {!sensorData ? (
        <div className={`${appStyles["text-center"]} ${appStyles["mt-4"]}`}>
          No IoT sensor selected.
          Select a sensor by clicking on it in the iTwin viewer.
        </div>
      ) : (
        <div>
          <ExpandableBlockWrapper className={appStyles["mb-5"]} title="Selected Sensor">
            <div className={`${appStyles["row-with-label"]} ${appStyles["mb-1"]}`}>
              <div>Sensor name:</div>
              <div>
                <Tooltip content="View sensor configuration">
                  <Button
                    className={appStyles["button-link"]}
                    styleType="borderless"
                    onClick={() => openExternalEntityUrl()}>
                    {sensorData.sensor.getName()}
                  </Button>
                </Tooltip>
                { entityLinkOpenInProgress ? (
                  <span className={styles["external-link-spinner"]}>
                    <ProgressRadial size="x-small" indeterminate={true}/>
                  </span>
                ) : (
                  <Icon
                    className={`${appStyles["color-muted"]} ${styles["external-link-icon"]}`}
                    iconSpec="icon-window-new"/>
                )}
              </div>
            </div>
            <div className={`${appStyles["row-with-label"]} ${appStyles["mb-1"]}`}>
              <div>Sensor ID:</div>
              <div>{sensorData.sensor.getId()}</div>
            </div>
            <div className={appStyles["row-with-label"]}>
              <div>Sensor type:</div>
              <div>
                {EntityTypeService.getType(EntityType.SENSOR, sensorData.sensor.getType() as string).getName()}
              </div>
            </div>
          </ExpandableBlockWrapper>

          <ExpandableBlockWrapper className={appStyles["mb-5"]} title="Active Alerts">
            {sensorData.alerts?.length ? (
              sensorData.alerts.map((alert: Alert, idx: number, alerts: Alert[]) => {
                return <div key={alert.getId()}>
                  <div className={`${appStyles["row-with-label"]} ${appStyles["mb-1"]}`}>
                    <div>Name:</div>
                    <div>{alert.getName()}</div>
                  </div>
                  <div className={`${appStyles["row-with-label"]} ${appStyles["mb-1"]}`}>
                    <div>Triggered on:</div>
                    <div>{alert.getLastTrigger()?.getDate()}</div>
                  </div>
                  <div className={`${appStyles["row-with-label"]} ${appStyles["mb-1"]}`}>
                    <div>Condition:</div>
                    <div>{alert.getLastTrigger()?.getDescription()}</div>
                  </div>
                  <div className={appStyles["row-with-label"]}>
                    <div>Priority:</div>
                    <div>
                      {AlertPriorityMetadata.getMetadata(alert.getPriority()).name}
                    </div>
                  </div>
                  {alert.canEdit() && (
                    <div className={`${appStyles["text-center"]} ${appStyles["mt-3"]}`}>
                      {alertActionInProgress === idx ? <ProgressRadial size="small" indeterminate={true}/> : (
                        <div className={styles["actions-container"]}>
                          <Button size="small" onClick={() => onAlertAction(alert, idx, "acknowledge")}>
                            Acknowledge
                          </Button>
                          <Button size="small" onClick={() => onAlertAction(alert, idx, "snooze")}>
                            Snooze
                          </Button>
                          <Button size="small" onClick={() => onAlertAction(alert, idx, "disable")}>
                            Disable
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  {idx < alerts.length - 1 && <hr className={styles["item-separator"]}/>}
                </div>;
              })
            ): (
              <div className={appStyles["color-muted"]}>
                No active alerts.
              </div>
            )}
          </ExpandableBlockWrapper>

          <ExpandableBlockWrapper className={appStyles["mb-4"]} title="Recent Readings">
            {sensorData.observations?.length ?
              <div>
                {sensorData.observations[0].hasObservations() && (
                  <div className={appStyles["row-with-label"]}>
                    <div>Date:</div>
                    <div>
                      {UtilitiesService.formatDate(sensorData.observations[0].getObservations()[0][0])}
                    </div>
                  </div>
                )}

                {sensorData.observations
                  .map((observationSet: ObservationSet, idx: number) => {
                    return <div key={idx}>
                      <div className={appStyles["row-with-label"]}>
                        <div className={`${idx === observationQueryIndex ? styles.selected : ""}`}>
                          {observationSet.getMetricName()}:
                        </div>
                        <div className={`${idx === observationQueryIndex ? styles.selected : ""}`}>
                          {observationSet.hasObservations() ?
                            (<span>
                              {UtilitiesService.formatNumericalValue(observationSet.getObservations()[0][1])}
                              &nbsp;
                              {observationSet.getUnitName()}
                            </span>)
                            : <span className={appStyles["color-muted"]}>No measurements</span>}
                        </div>
                        <div className={`${appStyles["text-right"]} ${styles["cta-container"]}`}>
                          {(canSave && observationQueryIndex !== idx) && (
                            <Tooltip content="Change this metric">
                              <IconButton
                                className={appStyles["button-xs"]}
                                size="small"
                                styleType="borderless"
                                onClick={() => editMetric(idx)}>
                                <Icon iconSpec={"icon-edit-object"}/>
                              </IconButton>
                            </Tooltip>
                          )}
                          {(canSave && obsQueryCount.current > 1) && (
                            <Tooltip content="Remove this metric">
                              <IconButton
                                className={appStyles["button-xs"]}
                                size="small"
                                styleType="borderless"
                                onClick={() => deleteMetric(sensorData, idx)}>
                                <Icon iconSpec="icon-close-circular"/>
                              </IconButton>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    </div>;
                  })
                }

                {(canSave && sensorData.observations.length < 5) && (
                  <div className={appStyles["row-with-label"]}>
                    <div>&nbsp;</div>
                    <div>
                      <Button
                        className={`${appStyles["button-sm"]} ${styles["add-metric-button"]}`}
                        size="small"
                        styleType="borderless"
                        startIcon={<Icon iconSpec="icon-add" />}
                        onClick={() => addMetric(sensorData)}>
                        Add Metric
                      </Button>
                    </div>
                  </div>
                )}

                {canSave && <hr className={styles["item-separator"]}/> }

                {canSave &&
                <MetricSelectForm
                  observationQueryIndex={observationQueryIndex}
                  observationQuery={
                    (sensorData.observations[observationQueryIndex] || sensorData.observations[0]).getObservationQuery() as ObservationQuery
                  }/>
                }

              </div>
              :
              <div className={appStyles["color-muted"]}>
                No measurements available.
              </div>
            }
          </ExpandableBlockWrapper>

          <div className={appStyles["text-center"]}>
            <Button
              className={appStyles["button-sm"]}
              size="small"
              styleType="borderless"
              startIcon={<Icon iconSpec="icon-close-circular" />}
              onClick={() =>IModelSettingsService.setSelectedEntity()}>
              Clear Selection
            </Button>
          </div>
        </div>
      )}
    </div>
  );

}
