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
  Text,
  Surface
} from "@itwin/itwinui-react";
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CreateTypeFromInterface, generateUrl } from "./utils";
import { EmptyMessage, LoadingOverlay } from "./utils";
import { handleError, WidgetHeader } from "./utils";
import "./Reports.scss";
import DeleteModal from "./DeleteModal";
import { Report, REPORTING_BASE_PATH } from "@itwin/insights-client";
import { ReportingClient } from "@itwin/insights-client";
import { IModelApp } from "@itwin/core-frontend";
import ReportAction from "./ReportAction";
import { ReportMappings } from "./ReportMappings";
import { HorizontalTile } from "./HorizontalTile";
import { SearchBar } from "./SearchBar";
import { Api, ApiContext, useApi } from "../context/ApiContext";
import { useActiveIModel } from "../hooks/useActiveIModel";

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
  apiContext: Api
) => {
  try {
    if (!iTwinId) return;
    setIsLoading(true);
    const reportingClientApi = new ReportingClient(generateUrl(REPORTING_BASE_PATH, apiContext.baseUrl));
    const reports = await reportingClientApi.getReports(apiContext.accessToken, iTwinId);
    setReports(reports ?? []);
  } catch (error: any) {
    handleError(error.status);
  } finally {
    setIsLoading(false);
  }
};

export const Reports = () => {
  const iTwinId = useActiveIModel().iTwinId;
  const apiContext = useApi();
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [reportsView, setReportsView] = useState<ReportsView>(
    ReportsView.REPORTS
  );
  const [selectedReport, setSelectedReport] = useState<
    Report | undefined
  >(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchValue, setSearchValue] = useState<string>("");
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    void fetchReports(setReports, iTwinId, setIsLoading, apiContext);
  }, [apiContext, iTwinId, setIsLoading]);

  const refresh = useCallback(async () => {
    setReportsView(ReportsView.REPORTS);
    setSelectedReport(undefined);
    await fetchReports(setReports, iTwinId, setIsLoading, apiContext);
  }, [apiContext, iTwinId, setReports]);

  const addReport = () => {
    setReportsView(ReportsView.ADDING);
  };

  const filteredReports = useMemo(() => reports.filter((x) =>
    [x.displayName, x.description]
      .join(" ")
      .toLowerCase()
      .includes(searchValue.toLowerCase())), [reports, searchValue]);

  switch (reportsView) {
    case ReportsView.ADDING:
      return iTwinId ? <ReportAction iTwinId={iTwinId ?? ""} returnFn={refresh} /> : null;
    case ReportsView.MODIFYING:
      return iTwinId ?
        <ReportAction
          iTwinId={iTwinId}
          report={selectedReport}
          returnFn={refresh}
        />
        : null;
    case ReportsView.REPORTSMAPPING:
      return selectedReport ? <ReportMappings report={selectedReport} goBack={refresh} /> : null;
    default:
      return (
        <>
          <WidgetHeader title={IModelApp.localization.getLocalizedString("ReportsConfigWidget:ITwinReports")} />
          <Surface className="reports-list-container">
            <div className="toolbar">
              <Button
                startIcon={<SvgAdd />}
                onClick={() => addReport()}
                styleType="high-visibility"
              >
                {IModelApp.localization.getLocalizedString("ReportsConfigWidget:New")}
              </Button>
              <div className="search-bar-container" data-testid="search-bar">
                <SearchBar searchValue={searchValue} setSearchValue={setSearchValue} disabled={isLoading} />
              </div>
            </div>
            {isLoading ?
              <LoadingOverlay /> :
              reports.length === 0 ?
                <EmptyMessage>
                  <>
                    {IModelApp.localization.getLocalizedString("ReportsConfigWidget:NoReports")}
                    <div>
                      <Button
                        onClick={() => addReport()}
                        styleType='cta'>
                        {IModelApp.localization.getLocalizedString("ReportsConfigWidget:CreateOneReportCTA")}
                      </Button>
                    </div>
                  </>
                </EmptyMessage> :
                <div className="reports-list">
                  {filteredReports.map((report) =>
                    <HorizontalTile
                      key={report.id}
                      title={report.displayName ?? ""}
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
                              {IModelApp.localization.getLocalizedString("ReportsConfigWidget:Modify")}
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
                              {IModelApp.localization.getLocalizedString("ReportsConfigWidget:Remove")}
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
                  )}
                </div>
            }
          </Surface>
          <DeleteModal
            entityName={selectedReport?.displayName ?? ""}
            show={showDeleteModal}
            setShow={setShowDeleteModal}
            onDelete={async () => {
              const reportingClientApi = new ReportingClient(generateUrl(REPORTING_BASE_PATH, apiContext.baseUrl))
              await reportingClientApi.deleteReport(
                apiContext.accessToken,
                selectedReport?.id ?? ""
              );
            }}
            refresh={refresh}
          />
        </>
      );
  }
};
