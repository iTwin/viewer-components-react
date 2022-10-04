/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  SvgAdd,
  SvgDelete,
  SvgEdit,
  SvgMore,
  SvgRefresh,
} from "@itwin/itwinui-icons-react";
import {
  Button,
  DropdownMenu,
  IconButton,
  MenuItem,
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
import { HorizontalTile } from "./HorizontalTile";
import { SearchBar } from "./SearchBar";
import type { ReportsApiConfig } from "../context/ReportsApiConfigContext";
import { useReportsApiConfig } from "../context/ReportsApiConfigContext";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";
import { useActiveIModelConnection } from "@itwin/appui-react";
import BulkExtractor from "./BulkExtractor";
import { ExtractionStates, ExtractionStatus } from "./ExtractionStatus";
import { STATUS_CHECK_INTERVAL } from "./Constants";

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
  const [selectedReports, setSelectedReports] = useState<Report[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [extractionStates, setExtractionStates] = useState<Map<string, ExtractionStates>>(new Map<string, ExtractionStates>());
  const [jobStarted, setJobStarted] = useState<boolean>(false);
  const [reportsView, setReportsView] = useState<ReportsView>(
    ReportsView.REPORTS
  );
  const [selectedReport, setSelectedReport] = useState<Report | undefined>(
    undefined
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchValue, setSearchValue] = useState<string>("");
  const [reports, setReports] = useState<Report[]>([]);
  const bulkExtractor = useMemo(() => new BulkExtractor(apiConfig), [apiConfig]);

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

  useEffect(() => {
    if (jobStarted) {
      const interval = window.setInterval(async () => {
        const states = await bulkExtractor.getStates(reports.map((r) => r.id));
        if (Array.from(states.values())
          .filter((x) => x === ExtractionStates.Succeeded ||
            x === ExtractionStates.Failed ||
            x === ExtractionStates.None)
          .length === states.size) {
          setJobStarted(false);
        }
        setExtractionStates(states);
      }, STATUS_CHECK_INTERVAL);
      return () => window.clearInterval(interval);
    }
    return;
  }, [bulkExtractor, reports, jobStarted]);

  useEffect(() => {
    if (!jobStarted) {
      const timeout = window.setTimeout(() => {
        setExtractionStates(new Map<string, ExtractionStates>());
      }, STATUS_CHECK_INTERVAL);
      return () => window.clearTimeout(timeout);
    }
    return;
  }, [jobStarted]);

  function onClickTile(e: any, report: Report) {
    if (e?.target?.className?.toString().split(" ").includes("rcw-horizontal-tile-container")) {
      if (!e.ctrlKey)
        setSelectedReports([]);

      setSelectedReports((sr) =>
        sr.some((r) => report.id === r.id)
          ? sr.filter(
            (r) => report.id !== r.id
          )
          : [...sr, report]
      );
    }
  }

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
        <ReportMappings report={selectedReport} goBack={refresh} />
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
                onClick={async () => {
                  setJobStarted(true);
                  const states = extractionStates;
                  selectedReports.map((report) => states.set(report.id, ExtractionStates.Starting));
                  await bulkExtractor.startJobs(selectedReports.map((report) => report.id));
                  setExtractionStates(states);
                  setSelectedReports([]);
                }}
                disabled={selectedReports.length === 0 ||
                  selectedReports.filter((sr) => (
                    (extractionStates.get(sr.id) ?? ExtractionStates.None >= 1) &&
                    (extractionStates.get(sr.id) ?? ExtractionStates.None <= 4)
                  )).length > 0}
              >
                <SvgRefresh />
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
                    <Button onClick={() => addReport()} styleType="cta">
                      {ReportsConfigWidget.localization.getLocalizedString(
                        "ReportsConfigWidget:CreateOneReportCTA"
                      )}
                    </Button>
                  </div>
                </>
              </EmptyMessage>
            ) : (
              <div className="reports-list">
                {filteredReports.map((report) => (
                  <HorizontalTile
                    key={report.id}
                    title={report.displayName}
                    subText={report.description ?? ""}
                    subtextToolTip={report.description ?? ""}
                    titleTooltip={report.displayName}
                    onClickTitle={() => {
                      setSelectedReport(report);
                      setReportsView(ReportsView.REPORTSMAPPING);
                    }}
                    selected={selectedReports.some((r) => report.id === r.id)}
                    onClick={(e) => onClickTile(e, report)}
                    actionGroup={
                      <div className="rcw-button-container">
                        <ExtractionStatus
                          state={extractionStates.get(report.id) ?? ExtractionStates.None}
                          clearExtractionState={() => {
                            extractionStates.delete(report.id);
                            bulkExtractor.clearJob(report.id);
                          }}
                        >
                          <DropdownMenu
                            menuItems={(close: () => void) => [
                              <MenuItem
                                key={0}
                                onClick={() => {
                                  setSelectedReport(report);
                                  setReportsView(ReportsView.MODIFYING);
                                }}
                                icon={<SvgEdit />}
                              >
                                {ReportsConfigWidget.localization.getLocalizedString(
                                  "ReportsConfigWidget:Modify"
                                )}
                              </MenuItem>,
                              <MenuItem
                                key={1}
                                onClick={() => {
                                  setSelectedReport(report);
                                  setShowDeleteModal(true);
                                  close();
                                }}
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
                        </ExtractionStatus>
                      </div>
                    }
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
