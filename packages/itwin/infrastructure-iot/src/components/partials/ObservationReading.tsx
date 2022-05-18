/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";

import type { ObservationSet } from "../../models/observations/ObservationSetModel";
import { UtilitiesService } from "../../services/UtilitiesService";

import appStyles from "../../styles/App.module.scss";

export function ObservationReading(props: {observationSet: ObservationSet}) {
  return (
    <div>
      <div className={appStyles["row-with-label"]}>
        <div className={appStyles["variable-width"]}>
          {props.observationSet.getMetricName()}:
        </div>
        <div className={appStyles["text-right"]}>
          {props.observationSet.hasObservations() ? (
            <span>
              {UtilitiesService.formatNumericalValue(props.observationSet.getObservations()[0][1])}
              &nbsp;
              {props.observationSet.getUnitName()}
            </span>
          ) : (
            <span className={appStyles["color-muted"]}>No measurements</span>
          )}
        </div>
      </div>
    </div>
  );
}
