/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "@itwin/core-react";
import { Button, IconButton, ProgressRadial, Tooltip } from "@itwin/itwinui-react";

import Highcharts from "highcharts";
import brandLight from "highcharts/themes/brand-light";
import brandDark from "highcharts/themes/brand-dark";
import HighchartsReact from "highcharts-react-official";
import { useResizeDetector } from "react-resize-detector";

import type { SensorData } from "../../models/entities/SensorDataInterface";
import { ObservationQueryMetadata } from "../../models/observations/ObservationQueryMetadataModel";
import type { ObservationSet } from "../../models/observations/ObservationSetModel";
import { DateRangeOption } from "../../models/observations/DateRangeOptionModel";
import { EntityDataService } from "../../services/entities/EntityDataService";
import { IModelSettingsService } from "../../services/imodel/IModelSettingsService";
import { UtilitiesService } from "../../services/UtilitiesService";

import appStyles from "../../styles/App.module.scss";
import styles from "./DeviceGraphWidget.module.scss";

export function DeviceGraphWidget() {

  const defaultRange = 3;
  const rangeOptions: DateRangeOption[] = [
    new DateRangeOption("1h",  { value: 1, unit: "hour" }),
    new DateRangeOption("12h", { value: 12, unit: "hour" }),
    new DateRangeOption("1d",  { value: 1, unit: "day" }),
    new DateRangeOption("1w",  { value: 1, unit: "week" }),
    new DateRangeOption("2w",  { value: 2, unit: "week" }),
    new DateRangeOption("1m",  { value: 1, unit: "month" }),
    new DateRangeOption("1y",  { value: 1, unit: "year" }),
    new DateRangeOption("All", null),
  ];

  // Subscribe to data of the selected sensor
  const observationSet = useRef<ObservationSet | null>(null);
  const [sensorData, setSensorData] = useState<SensorData | undefined>(undefined);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [currentRange, setCurrentRange] = useState<number>(defaultRange);

  const getCurrentRangeTimeStamp = (idx: number) => {
    if (rangeOptions[idx].getLabel() === "All") {
      return sensorData?.firstReadingDate;
    } else {
      const rangeSpan: any = rangeOptions[idx].getRangeSpan();
      return UtilitiesService.addToDate(new Date(), rangeSpan.value * -1, rangeSpan.unit).toISOString();
    }
  };

  const getObsQueryMetadata = (idx: number) => {
    return new ObservationQueryMetadata(getCurrentRangeTimeStamp(idx), observationQueryMetadata.getWindowResolution());
  };

  // Create a query metadata store for start date and window resolution
  const [observationQueryMetadata, setObservationQueryMetadata] = useState<ObservationQueryMetadata>(
    new ObservationQueryMetadata(getCurrentRangeTimeStamp(defaultRange), 1000)
  );

  const rangeSelected = (idx: number) => {
    setCurrentRange(idx);
    setObservationQueryMetadata(getObsQueryMetadata(idx));
  };

  useEffect(() => {
    const dataSubscription = EntityDataService.getObservationsForSelectedSensor$(observationQueryMetadata)
      .subscribe({
        next: (data: {loading: boolean, data: SensorData | undefined}) => {

          // Update loading state
          setLoadingData(data.loading);

          // We only care about updating data if it finished loading
          if (!data.loading) {

            // Update sensor data and cache observation set for internal chart operations
            const sensorData = data.data;
            setSensorData(sensorData);
            observationSet.current = sensorData?.observations?.length ? sensorData.observations[0] : null;

            // Update the chart options and data
            updateChartLoadingState();
            setChartOptions({
              yAxis: {
                title: {
                  text: observationSet.current ?
                    `${observationSet.current.getMetricName()} (${observationSet.current.getUnitName()})` :
                    "Sensor Data",
                },
              },
              series: [{
                data: observationSet.current?.getObservations() || [],
              }],
            } as any);
          }
        },
        error: () => {},
      });
    return () => {
      dataSubscription.unsubscribe();
    };
  }, [observationQueryMetadata]);

  // Set up default HighCharts theme
  if (UtilitiesService.getUiTheme() === "dark") {
    brandDark(Highcharts);
  } else {
    brandLight(Highcharts);
  }

  // Set up HighCharts options
  const chartRef = useRef<HighchartsReact.RefObject | null>(null);
  const [chartOptions, setChartOptions] = useState<Highcharts.Options>({
    chart: {
      type: "line",
      backgroundColor: "none",
    },
    title: {
      text: undefined,
    },
    xAxis: {
      type: "datetime",
      gridLineWidth: 1,
    },
    yAxis: {
      title: {
        text: "Sensor Data",
      },
      gridLineWidth: 1,
      labels: {
        formatter() {
          return UtilitiesService.formatNumericalValue((this as any).value, 2, true);
        },
      },
    },
    plotOptions: {
      series: {
        states: {
          hover: {
            lineWidthPlus: 0,
          },
        },
        marker: {
          enabled: false,
          states: {
            hover: {
              radius: 3,
            },
          },
        },
      },
    },
    tooltip: {
      crosshairs: [{
        dashStyle: "dash",
      }],
      formatter() {

        let out = "";

        out += "<strong>";
        out += observationSet.current?.getEntityName() || "IoT Sensor";
        out += "</strong><br/>";

        if (observationSet.current) {
          const metric = observationSet.current.getMetricName();
          const x = UtilitiesService.formatDate((this as any).x);
          const unitNotation = observationSet.current.getUnitName();
          const y = UtilitiesService.formatNumericalValue((this as any).y);
          out += `<strong>${metric}:&nbsp;&nbsp;</strong>${y}&nbsp;${unitNotation}<br/>`;
          out += `<strong>Date:&nbsp;&nbsp;</strong>${x}`;
        }

        return out;
      },
    },
    credits: {
      enabled: false,
    },
    legend: {
      enabled: false,
    },
    loading: {
      labelStyle: {
        fontWeight: "normal",
        position: "relative",
        top: "40%",
      },
      style: {
        backgroundColor: "none",
      },
    },
    series: [{
      data: [],
    }],
  } as any);

  // Update HighCharts loading state
  const updateChartLoadingState = () => {
    if (chartRef.current) {
      if (observationSet.current && observationSet.current.hasObservations()) {
        chartRef.current.chart.hideLoading();
      } else {
        chartRef.current.chart.showLoading("No measurements available");
      }
    }
  };

  // Resize chart when container size changes
  // Also update the query metadata when width substantially changes
  const containerRef = useRef<HTMLInputElement | null>(null);
  const onResizeContainer = useCallback(() => {
    if (chartRef.current && containerRef.current) {
      const newChartHeight = containerRef.current.clientHeight - 38;
      if (chartRef.current.chart.chartHeight !== newChartHeight) {
        chartRef.current.chart.setSize(undefined, newChartHeight, false);
      }
      const newChartWidth = containerRef.current.clientWidth;
      const currentChartWidth = observationQueryMetadata.getWindowResolution() || 0;
      if (Math.abs(newChartWidth - currentChartWidth) > 250) {
        setObservationQueryMetadata(
          new ObservationQueryMetadata(
            observationQueryMetadata.getStartDate(),
            newChartWidth
          )
        );
      }
    }
  }, [observationQueryMetadata]);
  useResizeDetector({
    targetRef: containerRef,
    refreshMode: "throttle",
    refreshRate: 500,
    onResize: onResizeContainer,
  });

  return (
    <div ref={containerRef} className={styles["device-graph-widget-wrapper"]}>
      <div className={appStyles["widget-wrapper"]}>
        {!sensorData && (
          <div className={`${appStyles["text-center"]} ${appStyles["mt-4"]}`}>
            No IoT sensor selected.
            Select a sensor by clicking on it in the iTwin viewer.
          </div>
        )}
        <div className={`${styles["chart-canvas"]} ${!sensorData ? appStyles.hidden : ""}`}>
          <div className={styles["chart-heading"]}>
            <div className={styles["time-controls"]}>
              {rangeOptions
                .map((rangeOption: DateRangeOption, idx: number) => (
                  <Button
                    key={idx}
                    className={currentRange === idx ? styles.selected : ""}
                    size="small"
                    styleType="borderless"
                    onClick={() => rangeSelected(idx)}>
                    {rangeOption.getLabel()}
                  </Button>
                ))
              }
            </div>
            <h3 className={styles["chart-title"]}>
              {sensorData?.sensor.getName() || "IoT Sensor"}
              <Tooltip content="Clear selected sensor">
                <IconButton
                  size="small"
                  styleType="borderless"
                  onClick={() =>IModelSettingsService.setSelectedEntity()}>
                  <Icon iconSpec="icon-close-circular" />
                </IconButton>
              </Tooltip>
            </h3>
          </div>
          <div>
            <HighchartsReact ref={chartRef} highcharts={Highcharts} options={chartOptions}/>
          </div>
        </div>
      </div>
      {loadingData && (
        <div className={styles["device-graph-widget-spinner"]}>
          <ProgressRadial indeterminate={true}/>
        </div>
      )}
    </div>
  );
}
