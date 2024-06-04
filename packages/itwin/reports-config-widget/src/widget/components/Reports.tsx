/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { SvgAdd, SvgPlay, SvgRefresh } from "@itwin/itwinui-icons-react";
import { Button, IconButton } from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { CreateTypeFromInterface } from "./utils";
import { EmptyMessage, handleError, LoadingOverlay } from "./utils";
import "./Reports.scss";
import DeleteModal from "./DeleteModal";
import type { Report, ReportsClient } from "@itwin/insights-client";
import { ReportHorizontalTile } from "./ReportHorizontalTile";
import { SearchBar } from "./SearchBar";
import { useReportsConfigApi } from "../context/ReportsConfigApiContext";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";
import type { AccessToken } from "@itwin/core-bentley";
import { BeEvent } from "@itwin/core-bentley";
import { useBulkExtractor } from "../context/BulkExtractorContext";

export type ReportType = CreateTypeFromInterface<Report>;

const fetchReports = async (
  setReports: (reports: Report[]) => void,
  iTwinId: string | undefined,
  setIsLoading: (isLoading: boolean) => void,
  reportsClient: ReportsClient,
  getAccessToken: () => Promise<AccessToken>,
) => {
  try {
    if (!iTwinId) return;
    setIsLoading(true);
    const accessToken = await getAccessToken();
    const reports = await reportsClient.getReports(accessToken, iTwinId);
    setReports(reports ?? []);
  } catch (error: any) {
    handleError(error.status);
  } finally {
    setIsLoading(false);
  }
};

/**
 * Props for {@link Reports} component.
 * @public
 */
export interface ReportsProps {
  onClickAddReport?: () => void;
  onClickReportTitle?: (report: Report) => void;
  onClickReportModify?: (report: Report) => void;
}

/**
 * Component to manage and list reports for an iTwin.
 * @public
 */
export const Reports = ({ onClickAddReport, onClickReportModify, onClickReportTitle }: ReportsProps) => {
  const { iTwinId, getAccessToken, reportsClient } = useReportsConfigApi();
  const { bulkExtractor } = useBulkExtractor();
  const [showDeleteModal, setShowDeleteModal] = useState<Report | undefined>(undefined);
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchValue, setSearchValue] = useState<string>("");
  const [reports, setReports] = useState<Report[]>([]);
  const jobStartEvent = useMemo(() => new BeEvent<(reportId: string) => void>(), []);

  useEffect(() => {
    void fetchReports(setReports, iTwinId, setIsLoading, reportsClient, getAccessToken);
  }, [getAccessToken, iTwinId, reportsClient, setIsLoading]);

  const refresh = useCallback(async () => {
    await fetchReports(setReports, iTwinId, setIsLoading, reportsClient, getAccessToken);
  }, [getAccessToken, iTwinId, reportsClient]);

  const filteredReports = useMemo(
    () => reports.filter((x) => [x.displayName, x.description].join(" ").toLowerCase().includes(searchValue.toLowerCase())),
    [reports, searchValue],
  );

  const onSelectionChange = (reportId: string, control: boolean) => {
    if (!control) setSelectedReportIds([]);

    setSelectedReportIds((sr) => (sr.some((r) => reportId === r) ? sr.filter((r) => reportId !== r) : [...sr, reportId]));
  };

  const updateDatasets = useCallback(async () => {
    if (!bulkExtractor) return;
    await bulkExtractor.runReportExtractions(selectedReportIds);
    selectedReportIds.map((reportId) => jobStartEvent.raiseEvent(reportId));
    setSelectedReportIds([]);
  }, [selectedReportIds, jobStartEvent, bulkExtractor]);

  if (!bulkExtractor) return null;

  return (
    <>
      <div className="rcw-reports-list-container">
        <div className="rcw-toolbar">
          <div className="rcw-button-spacing">
            {onClickAddReport && (
              <Button startIcon={<SvgAdd />} onClick={onClickAddReport} styleType="high-visibility" title="New Report">
                {ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:New")}
              </Button>
            )}
            <IconButton
              title={ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:UpdateDatasets")}
              onClick={updateDatasets}
              disabled={selectedReportIds.length === 0}
            >
              <SvgPlay />
            </IconButton>
          </div>
          <div className="rcw-search-bar-container" data-testid="rcw-search-bar">
            <IconButton
              title={ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Refresh")}
              onClick={refresh}
              disabled={isLoading}
              styleType="borderless"
            >
              <SvgRefresh />
            </IconButton>
            <SearchBar searchValue={searchValue} setSearchValue={setSearchValue} disabled={isLoading} />
          </div>
        </div>
        {isLoading ? (
          <LoadingOverlay />
        ) : reports.length === 0 && onClickAddReport ? (
          <EmptyMessage>
            <>
              {ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:NoReports")}
              <div>
                <Button onClick={onClickAddReport} styleType="cta">
                  {ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:CreateOneReportCTA")}
                </Button>
              </div>
            </>
          </EmptyMessage>
        ) : (
          <div className="rcw-reports-list">
            {filteredReports.map((report) => (
              <ReportHorizontalTile
                key={report.id}
                report={report}
                onClickTitle={onClickReportTitle}
                jobStartEvent={jobStartEvent}
                bulkExtractor={bulkExtractor}
                onClickDelete={() => {
                  setShowDeleteModal(report);
                }}
                onClickModify={onClickReportModify}
                onSelectionChange={onSelectionChange}
                selected={selectedReportIds.some((reportId) => report.id === reportId)}
              />
            ))}
          </div>
        )}
      </div>
      <DeleteModal
        entityName={showDeleteModal?.displayName}
        onClose={() => setShowDeleteModal(undefined)}
        onDelete={async () => {
          const accessToken = await getAccessToken();
          await reportsClient.deleteReport(accessToken, showDeleteModal?.id ?? "");
        }}
        refresh={refresh}
      />
    </>
  );
};
