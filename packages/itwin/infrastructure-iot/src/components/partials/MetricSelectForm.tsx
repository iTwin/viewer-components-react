/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useState } from "react";

import { Select, useTheme } from "@itwin/itwinui-react";
import type { SelectOption } from "@itwin/itwinui-react/esm/core/Select/Select";

import { find as _find, map as _map } from "lodash";

import type { ObservationQuery } from "../../models/observations/ObservationQueryModel";
import type { MetricCategory } from "../../models/observations/MetricCategoryModel";
import type { Metric } from "../../models/observations/MetricModel";
import type { Unit } from "../../models/observations/UnitModel";
import { MetricService } from "../../services/observations/MetricService";
import { IModelSettingsService } from "../../services/imodel/IModelSettingsService";

import { MetricParamSelectForm } from "./MetricParamSelectForm";

import appStyles from "../../styles/App.module.scss";

export function MetricSelectForm(props: {observationQueryIndex: number, observationQuery: ObservationQuery}) {

  // This is needed to iTwin React component to respect system-wide light/dark mode
  useTheme("os");

  // We work with a local copy of the passed in observation query so we don"t modify parent props
  const [observationQuery, setObservationQuery] = useState<ObservationQuery>(props.observationQuery);
  useEffect(() => {
    setObservationQuery(props.observationQuery);
  }, [props.observationQuery]);

  // Retrieve all metrics for selected sensor
  const [metricCategories, setMetricCategories] = useState<MetricCategory[]>([]);
  useEffect(() => {
    const dataSubscription = MetricService.getMetrics$(observationQuery.getSensorIds())
      .subscribe((metricCategories: MetricCategory[]) => {
        setMetricCategories(metricCategories);
      });
    return () => {
      dataSubscription.unsubscribe();
    };
  }, [observationQuery]);

  // Returns currently selected metric category
  const getSelectedMetricCategory = useCallback(
    (): any => {
      if (!observationQuery.getMetricCategory()) {
        const selectedCategory = _find(metricCategories, (category: MetricCategory) => {
          const selectedMetric = _find(category.getMetrics(), (metric: Metric) => {
            return metric.getId() === observationQuery.getMetric();
          });
          return !!selectedMetric;
        });
        if (selectedCategory) {
          observationQuery.setMetricCategory(selectedCategory.getId());
        }
      }
      return _find(metricCategories, (category: MetricCategory) => {
        return category.getId() === observationQuery.getMetricCategory();
      });
    }, [metricCategories, observationQuery]);

  // Returns currently selected metric
  const getSelectedMetric = useCallback(
    (): any => {
      const category = getSelectedMetricCategory();
      if (category) {
        return _find(category.getMetrics(), (metric: Metric) => {
          return metric.getId() === observationQuery.getMetric();
        });
      } else {
        return undefined;
      }
    }, [getSelectedMetricCategory, observationQuery]);

  // Returns currently selected unit
  const getSelectedUnit = useCallback(
    (): any => {
      const metric = getSelectedMetric();
      if (metric) {
        return _find(metric.getUnits(), (unit: Unit) => {
          return unit.getId() === observationQuery.getUnit();
        });
      } else {
        return undefined;
      }
    }, [getSelectedMetric, observationQuery]);

  // Returns select input object based on select type
  const getSelectInputOptions = useCallback(
    (type: "category" | "metric" | "unit"): SelectOption<string>[] => {
      switch (type) {
        case "category":
          return _map(metricCategories, (category: MetricCategory) => {
            return { value: category.getId(), label: category.getName() };
          });
        case "metric":
          const selectedCategory = getSelectedMetricCategory();
          if (selectedCategory) {
            return _map(selectedCategory.getMetrics(), (metric: Metric) => {
              return { value: metric.getId(), label: metric.getName() };
            });
          } else {
            return [];
          }
        case "unit":
          const selectedMetric = getSelectedMetric();
          if (selectedMetric) {
            return _map(selectedMetric.getUnits(), (unit: Unit) => {
              return { value: unit.getId(), label: unit.getName() };
            });
          } else {
            return [];
          }
      }
    }, [metricCategories, getSelectedMetricCategory, getSelectedMetric]);

  // Update observation query when one of the select input changes
  // We may have to recursively call this more than once for dependent objects (ex. metric > unit)
  const updateObservationQuery = (newCategory?: string, newMetric?: string, newUnit?: string): void => {
    if (newCategory) {
      observationQuery.setMetricCategory(newCategory);
      if (getSelectedMetricCategory().getMetrics()[0]) {
        updateObservationQuery(undefined, getSelectedMetricCategory().getMetrics()[0].getId());
      } else {
        updateIModelSettings();
      }
    }
    if (newMetric) {
      observationQuery.setMetric(newMetric);
      if (!getSelectedUnit()) {
        updateObservationQuery(undefined, undefined, getSelectedMetric().getDefaultUnit());
      } else {
        updateIModelSettings();
      }
    }
    if (newUnit) {
      observationQuery.setUnit(newUnit);
      updateIModelSettings();
    }
  };

  // Updates iModel settings with the new observation query for sensor
  // which will kick off retrieving new observations and reloading this component
  const updateIModelSettings = (): void => {
    IModelSettingsService.setEntityObservationQuery(
      observationQuery.getSensorIds()[0],
      props.observationQueryIndex,
      observationQuery
    );
  };

  return (
    <div>
      <div className={`${appStyles["row-with-label"]} ${appStyles["mb-2"]}`}>
        <div>Metric Type:</div>
        <div>
          <Select
            size="small"
            placeholder="Select metric type..."
            options={getSelectInputOptions("category")}
            value={getSelectedMetricCategory()?.getId()}
            onChange={(newValue: string) => {
              if (newValue !== getSelectedMetricCategory()?.getId()) {
                updateObservationQuery(newValue);
              }
            }}/>
        </div>
      </div>
      <div className={`${appStyles["row-with-label"]} ${appStyles["mb-2"]}`}>
        <div>Metric:</div>
        <div>
          <Select
            size="small"
            placeholder="Select metric..."
            options={getSelectInputOptions("metric")}
            value={getSelectedMetric()?.getId()}
            onChange={(newValue: string) => {
              if (newValue !== getSelectedMetric()?.getId()) {
                updateObservationQuery(undefined, newValue);
              }
            }}/>
        </div>
      </div>
      <div className={appStyles["row-with-label"]}>
        <div>Unit:</div>
        <div>
          {!getSelectedMetric()?.isUnitless() ? (
            <Select
              size="small"
              placeholder="Select unit..."
              options={getSelectInputOptions("unit")}
              value={getSelectedUnit()?.getId()}
              onChange={(newValue: string) => {
                if (newValue !== getSelectedUnit()?.getId()) {
                  updateObservationQuery(undefined, undefined, newValue);
                }
              }}/>
          ): (
            <span className={appStyles["color-muted"]}> No units required</span>
          )}
        </div>
      </div>
      {getSelectedMetric()?.hasMetricParams() && (
        <div className={appStyles["mt-2"]}>
          <MetricParamSelectForm
            availableParams={getSelectedMetric()?.getMetricParams() || []}
            observationQuery={observationQuery}
            onChange={(newValue: {[key: string]: any}) => {
              observationQuery.setMetricParams(newValue);
              updateIModelSettings();
            }}/>
        </div>
      )}
    </div>
  );
}
