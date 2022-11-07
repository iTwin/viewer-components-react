/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  SvgAdd,
  SvgPlay,
} from "@itwin/itwinui-icons-react";
import {
  Button,
  IconButton,
  Surface,
} from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { CreateTypeFromInterface } from "./utils";
import {
  EmptyMessage,
  generateUrl,
  handleError,
  LoadingOverlay,
  WidgetHeader,
} from "./utils";
import "./Reports.scss";
import DeleteModal from "./DeleteModal";
import type { Report } from "@itwin/insights-client";
import { REPORTING_BASE_PATH, ReportsClient } from "@itwin/insights-client";
import ReportAction from "./ReportAction";
import { ReportMappings } from "./ReportMappings";
import { ReportHorizontalTile } from "./ReportHorizontalTile";
import { SearchBar } from "./SearchBar";
import type { ReportsApiConfig } from "../context/ReportsApiConfigContext";
import { useReportsApiConfig } from "../context/ReportsApiConfigContext";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";
import { useActiveIModelConnection } from "@itwin/appui-react";
import BulkExtractor from "./BulkExtractor";
import { BeEvent } from "@itwin/core-bentley";

export type ReportType = CreateTypeFromInterface<Report>;

enum ReportsView {
  REPORTS = "reports",
  REPORTSMAPPING = "reportsmapping",
  ADDING = "adding",
  MODIFYING = "modifying",
}

const fetchReports = async (
  setReports: React.Dispatch<React.SetStateAction<Report[]>>,
  iTwinId: string | undefined,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  apiContext: ReportsApiConfig
) => {
  try {
    if (!iTwinId) return;
    setIsLoading(true);
    const reportsClientApi = new ReportsClient(
      generateUrl(REPORTING_BASE_PATH, apiContext.baseUrl)
    );
    const accessToken = await apiContext.getAccessToken();
    const reports = await reportsClientApi.getReports(accessToken, iTwinId);
    setReports(reports ?? []);
  } catch (error: any) {
    handleError(error.status);
  } finally {
    setIsLoading(false);
  }
};

export const Reports = () => {
  const iTwinId = useActiveIModelConnection()?.iTwinId ?? "";
  const apiConfig = useReportsApiConfig();
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [reportsView, setReportsView] = useState<ReportsView>(
    ReportsView.REPORTS
  );
  const [selectedReport, setSelectedReport] = useState<Report | undefined>(
    undefined
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchValue, setSearchValue] = useState<string>("");
  const [reports, setReports] = useState<Report[]>([]);
  const bulkExtractor = useMemo(
    () => new BulkExtractor(apiConfig, reports.map((r) => r.id)),
    [apiConfig, reports]
  );
  const jobStartEvent = useMemo(
    () => new BeEvent<(reportId: string) => void>(),
    []
  );

  useEffect(() => {
    void fetchReports(setReports, iTwinId, setIsLoading, apiConfig);
  }, [apiConfig, iTwinId, setIsLoading]);

  const refresh = useCallback(async () => {
    setReportsView(ReportsView.REPORTS);
    setSelectedReport(undefined);
    await fetchReports(setReports, iTwinId, setIsLoading, apiConfig);
  }, [apiConfig, iTwinId, setReports]);

  const addReport = () => {
    setReportsView(ReportsView.ADDING);
  };

  const filteredReports = useMemo(
    () =>
      reports.filter((x) =>
        [x.displayName, x.description]
          .join(" ")
          .toLowerCase()
          .includes(searchValue.toLowerCase())
      ),
    [reports, searchValue]
  );

  const onSelectionChange = (reportId: string, control: boolean) => {
    if (!control)
      setSelectedReportIds([]);

    setSelectedReportIds((sr) =>
      sr.some((r) => reportId === r)
        ? sr.filter(
          (r) => reportId !== r
        )
        : [...sr, reportId]
    );
  };

  const updateDatasets = useCallback(async () => {
    selectedReportIds.map((reportId) => jobStartEvent.raiseEvent(reportId));
    setSelectedReportIds([]);
    await bulkExtractor.startJobs(selectedReportIds);
  }, [selectedReportIds, jobStartEvent, bulkExtractor]);

  switch (reportsView) {
    case ReportsView.ADDING:
      return iTwinId ? (
        <ReportAction iTwinId={iTwinId ?? ""} returnFn={refresh} />
      ) : null;
    case ReportsView.MODIFYING:
      return iTwinId ? (
        <ReportAction
          iTwinId={iTwinId}
          report={selectedReport}
          returnFn={refresh}
        />
      ) : null;
    case ReportsView.REPORTSMAPPING:
      return selectedReport ? (
        <ReportMappings report={selectedReport} bulkExtractor={bulkExtractor} goBack={refresh} />
      ) : null;
    default:
      return (
        <>
          <WidgetHeader
            title={ReportsConfigWidget.localization.getLocalizedString(
              "ReportsConfigWidget:ITwinReports"
            )}
          />
          <Surface className="reports-list-container">
            <div className="rcw-toolbar">
              <Button
                startIcon={<SvgAdd />}
                onClick={() => addReport()}
                styleType="high-visibility"
              >
                {ReportsConfigWidget.localization.getLocalizedString(
                  "ReportsConfigWidget:New"
                )}
              </Button>
              <IconButton
                title={ReportsConfigWidget.localization.getLocalizedString(
                  "ReportsConfigWidget:UpdateDatasets"
                )}
                onClick={updateDatasets}
                disabled={selectedReportIds.length === 0}
              >
                < SvgPlay />
              </IconButton>
              <div className="rcw-search-bar-container" data-testid="search-bar">
                <div className="rcw-search-button">
                  <SearchBar
                    searchValue={searchValue}
                    setSearchValue={setSearchValue}
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>
            {isLoading ? (
              <LoadingOverlay />
            ) : reports.length === 0 ? (
              <EmptyMessage>
                <>
                  {ReportsConfigWidget.localization.getLocalizedString(
                    "ReportsConfigWidget:NoReports"
                  )}
                  <div>
                    <Button onClick={addReport} styleType="cta">
                      {ReportsConfigWidget.localization.getLocalizedString(
                        "ReportsConfigWidget:CreateOneReportCTA"
                      )}
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
                    onClickTitle={() => {
                      setSelectedReport(report);
                      setReportsView(ReportsView.REPORTSMAPPING);
                    }}
                    jobStartEvent={jobStartEvent}
                    bulkExtractor={bulkExtractor}
                    onClickDelete={() => {
                      setSelectedReport(report);
                      setShowDeleteModal(true);
                    }}
                    onClickModify={() => {
                      setSelectedReport(report);
                      setReportsView(ReportsView.MODIFYING);
                    }}
                    onSelectionChange={onSelectionChange}
                    selected={selectedReportIds.some((reportId) => report.id === reportId)}
                  />
                ))}
              </div>
            )}
          </Surface>
          <DeleteModal
            entityName={selectedReport?.displayName ?? ""}
            show={showDeleteModal}
            setShow={setShowDeleteModal}
            onDelete={async () => {
              const reportsClientApi = new ReportsClient(
                generateUrl(REPORTING_BASE_PATH, apiConfig.baseUrl)
              );
              const accessToken = await apiConfig.getAccessToken();
              await reportsClientApi.deleteReport(
                accessToken,
                selectedReport?.id ?? ""
              );
            }}
            refresh={refresh}
          />
        </>
      );
  }
};
