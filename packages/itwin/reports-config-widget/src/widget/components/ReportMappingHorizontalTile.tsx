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
  IconButton, ProgressRadial,
} from "@itwin/itwinui-react";
import {
  SvgDelete,
  SvgRefresh,
} from "@itwin/itwinui-icons-react";
import { HorizontalTile } from "./HorizontalTile";
import type { ReportMappingAndMapping } from "./ReportMappings";
import "./ReportMappingHorizontalTile.scss";
import { LoadingExtractionState } from "./ExtractionStates/LoadingExtractionState";

export interface ReportMappingHorizontalTileProps {
  jobStartEvent: BeEvent<(reportId: string) => void>;
  mapping: ReportMappingAndMapping;
  onClickDelete: () => void;
  bulkExtractor: BulkExtractor;
  odataFeedUrl: string;
}

export const ReportMappingHorizontalTile = (props: ReportMappingHorizontalTileProps) => {
  const [extractionState, setExtractionState] = useState<ExtractionStates>(ExtractionStates.None);
  const [jobStarted, setJobStarted] = useState<boolean>(true);
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

  const getExtractionState = async () => {
    const state = await props.bulkExtractor.getIModelState(props.mapping.imodelId, props.mapping.iModelName, props.odataFeedUrl);
    setExtractionState(state);
    if (state === ExtractionStates.Failed || state === ExtractionStates.Succeeded || state === ExtractionStates.None) {
      setJobStarted(false);
    }
  };

  useEffect(() => {
    if (jobStarted) {
      getExtractionState().catch((error) => {
        setExtractionState(ExtractionStates.Failed);
        setJobStarted(false);
        console.error(error);
      });
      window.clearInterval(interval.current);
      interval.current = window.setInterval(async () => {
        await getExtractionState();
      }, STATUS_CHECK_INTERVAL);
    }
    return () => window.clearInterval(interval.current);
  }, [props.mapping, props.bulkExtractor, props.odataFeedUrl, jobStarted, getExtractionState]);

  return (
    <HorizontalTile
      title={props.mapping.mappingName}
      subText={props.mapping.iModelName}
      titleTooltip={props.mapping.mappingDescription}
      actionGroup={(
        <div
          className="rcw-action-button"
          data-testid="tile-action-button">
          {extractionState === ExtractionStates.None ?
            jobStarted ? <LoadingExtractionState /> :
              (
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
                  disabled={jobStarted}
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
