/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Checkbox, Select, useTheme } from "@itwin/itwinui-react";

import type { ObservationQuery } from "../../models/observations/ObservationQueryModel";
import { MetricParamsMetadata } from "../../models/observations/MetricParamsMetadataModel";

import { InputWithUnit } from "./inputs/InputWithUnit";
import { InputDatePicker } from "./inputs/InputDatePicker";

import appStyles from "../../styles/App.module.scss";
import styles from "./MetricParamSelectForm.module.scss";

export function MetricParamSelectForm(props: {
  availableParams: { id: string }[];
  observationQuery: ObservationQuery;
  onChange: (newValue: {[key: string]: any}) => void;
}) {

  // This is needed to iTwin React component to respect system-wide light/dark mode
  useTheme("os");

  // Create reusable instance of params metadata
  const paramsMetadata = useMemo<MetricParamsMetadata>(() => {
    return new MetricParamsMetadata();
  }, []);

  // Rolling Interval (dt) is a very special case, with all kinds of special handling
  // Among them is that we want to preserve value/unit selection during a single component session,
  // so we cache that for the duration of component's life. Otherwise it will auto-adjust the user's values
  const dtValueCache = useRef<{value: number, unit?: string} | null>(null);

  // We work with a local copy of the passed in observation query so we don"t modify parent props
  const [observationQuery, setObservationQuery] = useState<ObservationQuery>(props.observationQuery);
  useEffect(() => {
    setObservationQuery(props.observationQuery);
  }, [props.observationQuery]);

  // Returns value for a given metric param
  const getParamValue = useCallback(
    (id: string): {value?: any, unit?: string} => {
      const paramValue = observationQuery.getMetricParam(id);
      if (paramValue) {
        if (id === "dt" && dtValueCache.current) {
          return dtValueCache.current;
        } else {
          return paramsMetadata.convertParamValue(id, paramValue);
        }
      } else {
        return {};
      }
    }, [paramsMetadata, observationQuery]);

  // Toggle a give metric param on/off, fire off query update even
  const onParamToggle = (id: string, event: any): void => {
    if (event.target.checked) {
      observationQuery.setMetricParam(id, paramsMetadata.getDefaultParamValue(id));
    } else {
      observationQuery.setMetricParam(id);
      if (id === "dt") {
        dtValueCache.current = null;
      }
    }
    props.onChange(observationQuery.getMetricParams());
  };

  // Update a give param's value, fire off query update event
  const onParamChange = (id: string, newValue: {value: any, unit?: string}): void => {
    switch (id) {
      case "dt":
        observationQuery.setMetricParam(
          id,
          {value: parseInt(newValue.value, 10) * parseInt(newValue.unit as string, 10)}
        );
        dtValueCache.current = newValue;
        break;
      default:
        observationQuery.setMetricParam(id, newValue);
        break;
    }
    props.onChange(observationQuery.getMetricParams());
  };

  return (
    <div>
      {!!props.availableParams.length && (
        <div className={appStyles["row-with-label"]}>
          <div>
            Parameters:
          </div>
          <div>
            {
              props.availableParams.map((param: { id: string }, idx: number, params: { id: string }[]) => {
                if (paramsMetadata.isKnownParam(param.id)) {
                  const isLast = idx === params.length - 1;
                  return <div key={param.id} className={!isLast ? appStyles["mb-2"] : ""}>
                    <div>
                      <Checkbox
                        label={paramsMetadata.getParamName(param.id)}
                        checked={observationQuery.hasMetricParam(param.id)}
                        onChange={(event: any) => {
                          onParamToggle(param.id, event);
                        }}/>
                    </div>
                    {
                      paramsMetadata.getParamType(param.id) !== "checkbox" &&
                      observationQuery.hasMetricParam(param.id) && (
                        <div className={`${appStyles["mt-1"]} ${styles["param-input-container"]}`}>
                          {
                            {
                              "select":
                                <Select
                                  size="small"
                                  options={paramsMetadata.getParamSelectOptions(param.id)}
                                  value={getParamValue(param.id).value}
                                  onChange={(newValue: string) => {
                                    if (newValue !== getParamValue(param.id).value) {
                                      onParamChange(param.id, {value: newValue});
                                    }
                                  }}/>,

                              "input-with-unit":
                                <InputWithUnit
                                  inputValue={getParamValue(param.id).value}
                                  unitOptions={paramsMetadata.getParamSelectOptions(param.id)}
                                  unitValue={getParamValue(param.id).unit}
                                  label={paramsMetadata.getParamInputLabel(param.id)}
                                  onChange={(newValue: {value: number, unit?: string}) => {
                                    onParamChange(param.id, newValue);
                                  }}/>,

                              "date-picker":
                                <InputDatePicker
                                  value={getParamValue(param.id).value}
                                  onChange={(newValue: string) => {
                                    onParamChange(param.id, {value: newValue});
                                  }}/>,

                            }[paramsMetadata.getParamType(param.id)]
                          }
                        </div>
                      )}
                  </div>;
                } else {
                  return null;
                }
              })
            }
          </div>
        </div>
      )}
    </div>
  );
}
