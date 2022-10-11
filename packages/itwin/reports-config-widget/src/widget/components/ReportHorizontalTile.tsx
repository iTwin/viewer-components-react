/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useEffect, useState } from "react";
import React from "react";
import type BulkExtractor from "./BulkExtractor";
import { ExtractionStates, ExtractionStatus } from "./ExtractionStatus";
import type { BeEvent } from "@itwin/core-bentley";
import { STATUS_CHECK_INTERVAL } from "./Constants";
import type { Report } from "@itwin/insights-client";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";
import {
  DropdownMenu,
  IconButton,
  MenuItem,
} from "@itwin/itwinui-react";
import {
  SvgDelete,
  SvgEdit,
  SvgMore,
} from "@itwin/itwinui-icons-react";
import { HorizontalTile } from "./HorizontalTile";

export interface ReportHorizontalTileProps {
  onClickTitle: (e: any) => void;
  selected: boolean;
  setSelectedReports: (value: React.SetStateAction<Report[]>) => void;
  bulkExtractor: BulkExtractor;
  jobStartEvent: BeEvent<(reportId: string) => void>;
  report: Report;
  onClickDelete: () => void;
  onClickModify: () => void;
}

export const ReportHorizontalTile = (props: ReportHorizontalTileProps) => {
  const [jobStarted, setJobStarted] = useState<boolean>(false);
  const [extractionState, setExtractionState] = useState<ExtractionStates>(ExtractionStates.None);

  if (props.jobStartEvent)
    props.jobStartEvent.addListener((startedReportId: string) => {
      if (startedReportId === props.report.id) {
        setExtractionState(ExtractionStates.Starting);
        setJobStarted(true);
      }
    });

  useEffect(() => {
    if (jobStarted) {
      const interval = window.setInterval(async () => {
        const state = props.bulkExtractor.getState(props.report.id);
        if (state) {
          setExtractionState(state);
          if (state === ExtractionStates.Failed || state === ExtractionStates.Succeeded) {
            setJobStarted(false);
          }
        }
      }, STATUS_CHECK_INTERVAL);
      return () => window.clearInterval(interval);
    }
    return;
  }, [props.report.id, props.bulkExtractor, jobStarted]);

  const onClickTile = (e: any) => {
    if (e?.target?.className?.toString().split(" ").includes("rcw-horizontal-tile-container")) {
      if (!e.ctrlKey)
        props.setSelectedReports([]);

      props.setSelectedReports((sr) =>
        sr.some((r) => props.report.id === r.id)
          ? sr.filter(
            (r) => props.report.id !== r.id
          )
          : [...sr, props.report]
      );
    }
  };

  return (
    <HorizontalTile
      title={props.report.displayName}
      subText={props.report.description ?? ""}
      subtextToolTip={props.report.description ?? ""}
      titleTooltip={props.report.displayName}
      onClick={onClickTile}
      onClickTitle={props.onClickTitle}
      selected={props.selected}
      actionGroup={extractionState === ExtractionStates.None ? (
        <div
          className="rcw-action-button"
          data-testid="tile-action-button">
          <DropdownMenu
            menuItems={() => [
              <MenuItem
                key={0}
                onClick={props.onClickModify}
                icon={<SvgEdit />}
              >
                {ReportsConfigWidget.localization.getLocalizedString(
                  "ReportsConfigWidget:Modify"
                )}
              </MenuItem>,
              <MenuItem
                key={1}
                onClick={props.onClickDelete}
                icon={<SvgDelete />}
              >
                {ReportsConfigWidget.localization.getLocalizedString(
                  "ReportsConfigWidget:Remove"
                )}
              </MenuItem>,
            ]}
          >
            <IconButton styleType="borderless">
              <SvgMore />
            </IconButton>
          </DropdownMenu>
        </div>
      ) : (
        <ExtractionStatus
          state={extractionState}
          clearExtractionState={() => {
            props.bulkExtractor.clearJob(props.report.id);
            setExtractionState(ExtractionStates.None);
          }}
        ></ExtractionStatus>
      )}
    ></HorizontalTile>
  );
};
