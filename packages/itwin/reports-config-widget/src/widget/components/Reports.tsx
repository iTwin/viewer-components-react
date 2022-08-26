/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  SvgAdd,
  SvgDelete,
  SvgEdit,
  SvgMore,
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
import { ReportsClient } from "@itwin/insights-client";
import { REPORTING_BASE_PATH } from "@itwin/insights-client";
import ReportAction from "./ReportAction";
import { ReportMappings } from "./ReportMappings";
import { HorizontalTile } from "./HorizontalTile";
import { SearchBar } from "./SearchBar";
import type { ReportsApiConfig } from "../context/ReportsApiConfigContext";
import { useReportsApiConfig } from "../context/ReportsApiConfigContext";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";
import { useActiveIModelConnection } from "@itwin/appui-react";

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
            <div className="toolbar">
              <Button
                startIcon={<SvgAdd />}
                onClick={() => addReport()}
                styleType="high-visibility"
              >
                {ReportsConfigWidget.localization.getLocalizedString(
                  "ReportsConfigWidget:New"
                )}
              </Button>
              <div className="search-bar-container" data-testid="search-bar">
                <SearchBar
                  searchValue={searchValue}
                  setSearchValue={setSearchValue}
                  disabled={isLoading}
                />
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
                    button={
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
                          <SvgMore
                            style={{
                              width: "16px",
                              height: "16px",
                            }}
                          />
                        </IconButton>
                      </DropdownMenu>
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
