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

export interface ReportMappingHorizontalTileProps {
  jobStartEvent: BeEvent<(iModelId: string) => void>;
  mapping: ReportMappingAndMapping;
  onClickDelete: () => void;
  bulkExtractor: BulkExtractor;
  odataFeedUrl: string;
}

export const ReportMappingHorizontalTile = (props: ReportMappingHorizontalTileProps) => {
  const [extractionState, setExtractionState] = useState<ExtractionStates>(ExtractionStates.None);
  const interval = useRef<number>();

  useEffect(() => {
    const listener = (startedIModelId: string) => {
      if (startedIModelId === props.mapping.imodelId) {
        setExtractionState(ExtractionStates.Starting);
      }
    };
    props.jobStartEvent.addListener(listener);

    return () => {
      props.jobStartEvent.removeListener(listener);
    };
  }, [props.jobStartEvent, props.mapping.imodelId]);

  const getExtractionState = useCallback(async () => {
    try {
      const state = await props.bulkExtractor.getIModelState(props.mapping.imodelId, props.mapping.iModelName, props.odataFeedUrl);
      if (state === ExtractionStates.Failed || state === ExtractionStates.Succeeded) {
        if (extractionState === ExtractionStates.Running) {
          setExtractionState(state);
        }
      } else {
        setExtractionState(state);
      }
    } catch (error) {
      setExtractionState(ExtractionStates.Failed);
      /* eslint-disable no-console */
      console.error(error);
    }
  }, [props.bulkExtractor, props.mapping.imodelId, props.mapping.iModelName, props.odataFeedUrl, extractionState]);

  useEffect(() => {
    void getExtractionState();
  }, [extractionState, getExtractionState]);

  useEffect(() => {
    window.clearInterval(interval.current);
    if (extractionState === ExtractionStates.None) return;
    interval.current = window.setInterval(async () => {
      await getExtractionState();
    }, STATUS_CHECK_INTERVAL);
    return () => window.clearInterval(interval.current);
  }, [extractionState, getExtractionState]);

  const handleUpdateDataset = useCallback(async () => {
    setExtractionState(ExtractionStates.Starting);
    await props.bulkExtractor.runIModelExtraction(props.mapping.imodelId);
    props.jobStartEvent.raiseEvent(props.mapping.imodelId);
  }, [props.bulkExtractor, props.jobStartEvent, props.mapping.imodelId]);

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
                  onClick={handleUpdateDataset}
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
