/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React, { useEffect, useRef, useState } from "react";
import type { BulkExtractor } from "./BulkExtractor";
import { ExtractionStates, ExtractionStatus } from "./ExtractionStatus";
import type { BeEvent } from "@itwin/core-bentley";
import { STATUS_CHECK_INTERVAL } from "./Constants";
import type { Report } from "@itwin/insights-client";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";
import { DropdownMenu, IconButton, MenuItem } from "@itwin/itwinui-react";
import { SvgDelete, SvgEdit, SvgMore } from "@itwin/itwinui-icons-react";
import { HorizontalTile } from "./HorizontalTile";

export interface ReportHorizontalTileProps {
  selected: boolean;
  onSelectionChange: (reportId: string, controlPressed: boolean) => void;
  bulkExtractor: BulkExtractor;
  jobStartEvent: BeEvent<(reportId: string) => void>;
  report: Report;
  onClickDelete: () => void;
  onClickModify?: (report: Report) => void;
  onClickTitle?: (report: Report) => void;
}

export const ReportHorizontalTile = (props: ReportHorizontalTileProps) => {
  const [jobStarted, setJobStarted] = useState<boolean>(false);
  const [extractionState, setExtractionState] = useState<ExtractionStates>(ExtractionStates.None);
  const interval = useRef<number>();

  useEffect(() => {
    const listener = (startedReportId: string) => {
      if (startedReportId === props.report.id) {
        setExtractionState(ExtractionStates.Starting);
        setJobStarted(true);
      }
    };
    props.jobStartEvent.addListener(listener);

    return () => {
      props.jobStartEvent.removeListener(listener);
    };
  }, [props.jobStartEvent, props.report.id]);

  useEffect(() => {
    if (jobStarted) {
      window.clearInterval(interval.current);
      interval.current = window.setInterval(async () => {
        const state = await props.bulkExtractor.getReportState(props.report.id);
        if (state) {
          setExtractionState(state);
          if (state === ExtractionStates.Failed || state === ExtractionStates.Succeeded) {
            setJobStarted(false);
          }
        }
      }, STATUS_CHECK_INTERVAL);
    }
    return () => window.clearInterval(interval.current);
  }, [props.report.id, props.bulkExtractor, jobStarted]);

  const onClickTile = (e: React.MouseEvent) => {
    if (e?.currentTarget.className?.toString().split(" ").includes("rcw-horizontal-tile-container")) {
      props.onSelectionChange(props.report.id, e.ctrlKey);
    }
  };

  return (
    <HorizontalTile
      title={props.report.displayName}
      subText={props.report.description ?? ""}
      subtextToolTip={props.report.description ?? ""}
      titleTooltip={props.report.displayName}
      onClick={onClickTile}
      onClickTitle={() => props.onClickTitle?.(props.report)}
      selected={props.selected}
      actionGroup={
        extractionState === ExtractionStates.None ? (
          <div className="rcw-action-button" data-testid="tile-action-button">
            <DropdownMenu
              menuItems={(close: () => void) =>
                [
                  props.onClickModify ? (
                    <MenuItem key={0} onClick={() => props.onClickModify?.(props.report)} icon={<SvgEdit />}>
                      {ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Modify")}
                    </MenuItem>
                  ) : (
                    []
                  ),
                  <MenuItem
                    key={1}
                    onClick={() => {
                      props.onClickDelete();
                      close();
                    }}
                    icon={<SvgDelete />}
                  >
                    {ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Remove")}
                  </MenuItem>,
                ].flat()
              }
            >
              <IconButton styleType="borderless" title={ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:ReportOptions")}>
                <SvgMore />
              </IconButton>
            </DropdownMenu>
          </div>
        ) : (
          <ExtractionStatus
            state={extractionState}
            clearExtractionState={() => {
              setExtractionState(ExtractionStates.None);
            }}
          ></ExtractionStatus>
        )
      }
    ></HorizontalTile>
  );
};
