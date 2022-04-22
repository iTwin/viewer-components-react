/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useActiveIModelConnection } from "@itwin/appui-react";
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
} from "@itwin/itwinui-react";
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CreateTypeFromInterface } from "./utils";
import { EmptyMessage, LoadingOverlay } from "./utils";
import { handleError, WidgetHeader } from "./utils";
import "./Reports.scss";
import DeleteModal from "./DeleteModal";
import type { Report } from "../../reporting";
import { ReportingClient } from "../../reporting/reportingClient";
import { IModelApp } from "@itwin/core-frontend";
import ReportAction from "./ReportAction";
import { ReportMappings } from "./ReportMappings";
import { HorizontalTile } from "./HorizontalTile";
import { SearchBar } from "./SearchBar";
import { Api, ApiContext, useApi } from "../context/ApiContext";

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
    const reportingClientApi = new ReportingClient(apiContext.prefix);
    const reports = await reportingClientApi.getReports(apiContext.accessToken, iTwinId);
    setReports(reports.reports ?? []);
  } catch (error: any) {
    handleError(error.status);
  } finally {
    setIsLoading(false);
  }
};

export const Reports = () => {
  const iTwinId = useActiveIModelConnection()?.iTwinId;
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
    setReports([]);
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
          <div className="reports-list-container">
            <div className="toolbar">
              <Button
                startIcon={<SvgAdd />}
                onClick={() => addReport()}
                styleType="high-visibility"
              >
                {IModelApp.localization.getLocalizedString("ReportsConfigWidget:New")}
              </Button>
              <div className="search-bar-container">
                <SearchBar searchValue={searchValue} setSearchValue={setSearchValue} disabled={isLoading} />
              </div>
            </div>
            {isLoading ?
              <LoadingOverlay /> :
              reports.length === 0 ?
                <EmptyMessage>
                  <>
                    {IModelApp.localization.getLocalizedString("ReportsConfigWidget:NoReports")}
                    <Text
                      className="iui-anchor"
                      onClick={() => addReport()}
                    > {IModelApp.localization.getLocalizedString("ReportsConfigWidget:CreateOneReportCTA")}</Text>
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

          </div>
          <DeleteModal
            entityName={selectedReport?.displayName ?? ""}
            show={showDeleteModal}
            setShow={setShowDeleteModal}
            onDelete={async () => {
              const reportingClientApi = new ReportingClient(apiContext.prefix);
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
