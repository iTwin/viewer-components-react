/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useEffect, useRef, useState } from "react";
import React from "react";
import type BulkExtractor from "./BulkExtractor";
import { ExtractionStates, ExtractionStatus } from "./ExtractionStatus";
import type { BeEvent } from "@itwin/core-bentley";
import { STATUS_CHECK_INTERVAL } from "./Constants";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";
import {
  IconButton,
} from "@itwin/itwinui-react";
import {
  SvgDelete,
  SvgRefresh,
} from "@itwin/itwinui-icons-react";
import { HorizontalTile } from "./HorizontalTile";
import type { ReportMappingAndMapping } from "./ReportMappings";
import "./ReportMappingHorizontalTile.scss";

export interface ReportMappingHorizontalTileProps {
  jobStartEvent: BeEvent<(reportId: string) => void>;
  mapping: ReportMappingAndMapping;
  onClickDelete: () => void;
  bulkExtractor: BulkExtractor;
  initialState?: ExtractionStates;
  odataFeedUrl: string;
}

export const ReportMappingHorizontalTile = (props: ReportMappingHorizontalTileProps) => {
  const [extractionState, setExtractionState] = useState<ExtractionStates>(props.initialState ?? ExtractionStates.None);
  const [jobStarted, setJobStarted] = useState<boolean>(props.initialState !== ExtractionStates.None);
  const interval = useRef<number>();

  useEffect(() => {
    const listener = (startedIModelId: string) => {
      if (startedIModelId === props.mapping.imodelId) {
        setExtractionState(ExtractionStates.Starting);
        setJobStarted(true);
      }
    };
    props.jobStartEvent.addListener(listener);

    return () => {
      props.jobStartEvent.removeListener(listener);
    };
  }, [props.jobStartEvent, props.mapping]);

  useEffect(() => {
    if (jobStarted) {
      window.clearInterval(interval.current);
      interval.current = window.setInterval(async () => {
        const state = props.bulkExtractor.getIModelState(props.mapping.imodelId, props.mapping.iModelName, props.odataFeedUrl);
        if (state) {
          setExtractionState(state);
          if (state === ExtractionStates.Failed || state === ExtractionStates.Succeeded) {
            setJobStarted(false);
          }
        }
      }, STATUS_CHECK_INTERVAL);
    }
    return () => window.clearInterval(interval.current);
  }, [props.mapping, props.bulkExtractor, props.odataFeedUrl, jobStarted]);

  return (
    <HorizontalTile
      title={props.mapping.mappingName}
      subText={props.mapping.iModelName}
      titleTooltip={props.mapping.mappingDescription}
      actionGroup={(
        <div
          className="rcw-action-button"
          data-testid="tile-action-button">
          {extractionState === ExtractionStates.None ? (
            <IconButton
              styleType="borderless"
              title={ReportsConfigWidget.localization.getLocalizedString(
                "ReportsConfigWidget:UpdateDataset"
              )}
              onClick={() => {
                props.jobStartEvent.raiseEvent(props.mapping.imodelId);
                props.bulkExtractor.runIModelExtraction(props.mapping.imodelId).catch((e) => {
                  /* eslint-disable no-console */
                  console.error(e);
                });
              }}
            >
              <SvgRefresh />
            </IconButton>
          ) : (
            <ExtractionStatus
              state={extractionState}
              clearExtractionState={() => {
                props.bulkExtractor.clearIModelJob(props.mapping.imodelId);
                setExtractionState(ExtractionStates.None);
              }}
            ></ExtractionStatus>
          )}
          <IconButton
            styleType="borderless"
            title={ReportsConfigWidget.localization.getLocalizedString(
              "ReportsConfigWidget:Remove"
            )}
            onClick={() => {
              props.onClickDelete();
            }}
            disabled={jobStarted}
          >
            <SvgDelete />
          </IconButton>
        </div >
      )}
    ></HorizontalTile >
  );
};
