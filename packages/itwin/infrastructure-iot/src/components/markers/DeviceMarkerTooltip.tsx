/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";

import { EntityType } from "../../enums/entities/EntityTypeEnum";
import type { SensorData } from "../../models/entities/SensorDataInterface";
import type { AlertPriorityMetadataObject } from "../../models/alerts/AlertPriorityMetadataObjectInterface";
import type { ObservationSet } from "../../models/observations/ObservationSetModel";
import { UtilitiesService } from "../../services/UtilitiesService";
import { EntityTypeService } from "../../services/entities/EntityTypeService";

import { ObservationReading } from "../partials/ObservationReading";

import appStyles from "../../styles/App.module.scss";
import styles from "./DeviceMarkerTooltip.module.scss";

export function DeviceMarkerTooltip(props: { data: SensorData, alertPriorityDisplayStyle: AlertPriorityMetadataObject }) {

  const entityTypeMetadata = EntityTypeService.getType(EntityType.SENSOR, props.data.sensor.getType() as string);
  const alertPriorityMetadata = props.alertPriorityDisplayStyle;

  return (
    <div className={styles.tooltip}>
      <div
        className={`${styles["alert-data"]} ${alertPriorityMetadata ? styles["active-alert"] : ""}`}
        style={{backgroundColor: alertPriorityMetadata.color}}>
        {props.data.alerts?.length ? (
          <div>
            <div className={styles["alert-priority"]}>
              {alertPriorityMetadata?.name} Alert
            </div>
            <div className={styles["alert-metadata"]}>
              Triggered on {props.data.alerts[0].getLastTrigger()?.getDate()}
            </div>
            <div className={styles["alert-metadata"]}>
              {props.data.alerts[0].getLastTrigger()?.getDescription()}
            </div>
          </div>
        ) : (
          <div className={styles["alert-priority"]}>
            Normal
          </div>
        )}
      </div>
      <div className={styles["sensor-data"]}>
        <div className={styles["sensor-metadata"]}>
          <span className={`${entityTypeMetadata.getIcon()} ${styles["sensor-icon"]}`}/>
          <div>
            <div className={styles["sensor-name"]}>
              {props.data.sensor.getName()}
            </div>
            <div className={styles["sensor-type"]}>
              {entityTypeMetadata.getName() }
            </div>
          </div>
        </div>
        <div className={styles["sensor-readings"]}>
          <h4 className={styles["sub-header"]}>
            Recent Measurements
          </h4>
          <div className={styles["readings-list"]}>
            {props.data.observations?.length && props.data.observations[0].hasObservations() ? (
              <div>
                <div className={appStyles["row-with-label"]}>
                  <div className={appStyles["variable-width"]}>Date:</div>
                  <div className={appStyles["text-right"]}>
                    {UtilitiesService.formatDate(props.data.observations[0].getObservations()[0][0])}
                  </div>
                </div>
                <div>
                  {props.data.observations
                    .map((observationSet: ObservationSet, idx: number) => {
                      return <div key={idx}>
                        <ObservationReading observationSet={observationSet}/>
                      </div>;
                    })}
                </div>
              </div>
            ) : (
              <div className={appStyles["color-muted"]}>
                No measurements available.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
