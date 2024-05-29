/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { BulkExtractor } from "./BulkExtractor";
import { ExtractionStates, ExtractionStatus } from "./ExtractionStatus";
import type { BeEvent } from "@itwin/core-bentley";
import { STATUS_CHECK_INTERVAL } from "./Constants";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";
import { IconButton } from "@itwin/itwinui-react";
import {
  SvgDelete,
  SvgPlay,
} from "@itwin/itwinui-icons-react";
import { HorizontalTile } from "./HorizontalTile";
import type { ReportMappingAndMapping } from "./ReportMappings";
import type { ExtractionRequestDetails } from "@itwin/insights-client";

export interface ReportMappingHorizontalTileProps {
  jobStartEvent: BeEvent<(iModelId: string) => void>;
  mapping: ReportMappingAndMapping;
  onClickDelete: () => void;
  bulkExtractor: BulkExtractor;
  odataFeedUrl: string;
}

export const ReportMappingHorizontalTile = (props: ReportMappingHorizontalTileProps) => {
  const [extractionState, setExtractionState] = useState<ExtractionStates>(ExtractionStates.None);
  const [jobStarted, setJobStarted] = useState<boolean>(true);
  const interval = useRef<number>();
  const initialLoad = useRef<boolean>(true);

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

  const getExtractionState = useCallback(async () => {
    const state = await props.bulkExtractor.getIModelState(props.mapping.imodelId, props.mapping.iModelName, props.odataFeedUrl);
    if (state === ExtractionStates.Failed || state === ExtractionStates.Succeeded || state === ExtractionStates.None) {
      setJobStarted(false);
      if (initialLoad.current) {
        initialLoad.current = false;
        setExtractionState(ExtractionStates.None);
        return;
      }
    } else {
      initialLoad.current = false;
    }
    setExtractionState(state);
  }, [props.mapping, props.bulkExtractor, props.odataFeedUrl]);

  useEffect(() => {
    if (jobStarted) {
      getExtractionState().catch((error) => {
        setExtractionState(ExtractionStates.Failed);
        setJobStarted(false);
        /* eslint-disable no-console */
        console.error(error);
      });
      window.clearInterval(interval.current);
      interval.current = window.setInterval(async () => {
        await getExtractionState();
      }, STATUS_CHECK_INTERVAL);
    }
    return () => window.clearInterval(interval.current);
  }, [jobStarted, getExtractionState]);

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
            (
              <>
                <IconButton
                  styleType="borderless"
                  title={ReportsConfigWidget.localization.getLocalizedString(
                    "ReportsConfigWidget:UpdateDataset"
                  )}
                  onClick={async () => {
                    setExtractionState(ExtractionStates.Starting);
                    const extractionRequestDetails: ExtractionRequestDetails = {
                      iModelId: props.mapping.imodelId,
                      mappings: [{ id: props.mapping.mappingId }],
                    };
                    await props.bulkExtractor.runIModelExtraction(extractionRequestDetails);
                    props.jobStartEvent.raiseEvent(props.mapping.imodelId);
                  }}
                  disabled={jobStarted}
                >
                  <SvgPlay />
                </IconButton>
                <IconButton
                  styleType="borderless"
                  title={ReportsConfigWidget.localization.getLocalizedString(
                    "ReportsConfigWidget:Remove"
                  )}
                  onClick={() => {
                    props.onClickDelete();
                  }}
                >
                  <SvgDelete />
                </IconButton>
              </>
            ) : (
              <ExtractionStatus
                state={extractionState}
                clearExtractionState={() => {
                  setExtractionState(ExtractionStates.None);
                }}
              ></ExtractionStatus>
            )}
        </div >
      )}
    />
  );
};
