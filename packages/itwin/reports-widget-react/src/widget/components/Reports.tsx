/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useActiveIModelConnection } from "@itwin/appui-react";
import {
  SvgAdd,
  SvgDelete,
  SvgEdit,
  SvgImport,
  SvgMore,
} from "@itwin/itwinui-icons-react";
import type {
  TablePaginatorRendererProps
} from "@itwin/itwinui-react";
import {
  Button,
  ButtonGroup,
  DropdownMenu,
  IconButton,
  LabeledInput,
  MenuItem,
  Table,
  tableFilters,
  TablePaginator,
} from "@itwin/itwinui-react";
import type { CellProps } from "react-table";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CreateTypeFromInterface } from "./utils";
import { handleError, WidgetHeader } from "./utils";
import "./Reports.scss";
import DeleteModal from "./DeleteModal";
import type { Report } from "../../reporting";
import { ReportingClient } from "../../reporting/reportingClient";
import { IModelApp } from "@itwin/core-frontend";
import ReportAction from "./ReportAction";
import { ReportMappings } from "./ReportMappings";
import { LocalizedTablePaginator } from "./LocalizedTablePaginator";

export type ReportType = CreateTypeFromInterface<Report>;

enum ReportsView {
  REPORTS = "reports",
  REPORTSMAPPING = "reportsmapping",
  ADDING = "adding",
  MODIFYING = "modifying",
}

const fetchReports = async (
  setReports: React.Dispatch<React.SetStateAction<Report[]>>,
  iTwinId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
) => {
  try {
    setIsLoading(true);
    const accessToken = (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    const reportingClientApi = new ReportingClient();
    const reports = await reportingClientApi.getReports(accessToken, iTwinId);
    setReports(reports.reports ?? []);
  } catch (error: any) {
    handleError(error.status);
  } finally {
    setIsLoading(false);
  }
};

const useFetchReports = (
  iTwinId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
): [
    Report[],
    React.Dispatch<React.SetStateAction<Report[]>>
  ] => {
  const [reports, setReports] = useState<Report[]>([]);
  useEffect(() => {
    void fetchReports(setReports, iTwinId, setIsLoading);
  }, [iTwinId, setIsLoading]);

  return [reports, setReports];
};

export const Reports = () => {
  const iTwinId = useActiveIModelConnection()?.iTwinId as string;
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [reportsView, setReportsView] = useState<ReportsView>(
    ReportsView.REPORTS
  );
  const [selectedReport, setSelectedReport] = useState<
    Report | undefined
  >(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [reports, setReports] = useFetchReports(iTwinId, setIsLoading);

  const refresh = useCallback(async () => {
    setReportsView(ReportsView.REPORTS);
    setSelectedReport(undefined);
    setReports([]);
    await fetchReports(setReports, iTwinId, setIsLoading);
  }, [iTwinId, setReports]);

  const addReport = async () => {
    setReportsView(ReportsView.ADDING);
  };

  const reportsColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "displayName",
            Header: IModelApp.localization.getLocalizedString("ReportsWidget:ReportName"),
            accessor: "displayName",
            Cell: (value: CellProps<Report>) => (
              <div
                className="iui-anchor"
                onClick={() => {
                  setSelectedReport(value.row.original);
                  setReportsView(ReportsView.REPORTSMAPPING);
                }}
              >
                {value.row.original.displayName}
              </div>
            ),
            Filter: tableFilters.TextFilter(),
          },
          {
            id: "description",
            Header: IModelApp.localization.getLocalizedString("ReportsWidget:Description"),
            accessor: "description",
            Filter: tableFilters.TextFilter(),
          },
          {
            id: "dropdown",
            Header: "",
            width: 80,
            Cell: (value: CellProps<ReportType>) => {
              return (
                <DropdownMenu
                  menuItems={(close: () => void) => [
                    <MenuItem
                      key={0}
                      onClick={() => {
                        setSelectedReport(value.row.original);
                        setReportsView(ReportsView.MODIFYING);
                      }}
                      icon={<SvgEdit />}
                    >
                      {IModelApp.localization.getLocalizedString("ReportsWidget:Modify")}
                    </MenuItem>,
                    <MenuItem
                      key={1}
                      onClick={() => {
                        setSelectedReport(value.row.original);
                        setShowDeleteModal(true);
                        close();
                      }}
                      icon={<SvgDelete />}
                    >
                      {IModelApp.localization.getLocalizedString("ReportsWidget:Remove")}
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
              );
            },
          },
        ],
      },
    ],
    []
  );

  switch (reportsView) {
    case ReportsView.ADDING:
      return <ReportAction iTwinId={iTwinId} returnFn={refresh} />;
    case ReportsView.MODIFYING:
      return (
        <ReportAction
          iTwinId={iTwinId}
          report={selectedReport}
          returnFn={refresh}
        />
      );
    case ReportsView.REPORTSMAPPING:
      return selectedReport ? <ReportMappings report={selectedReport} goBack={refresh} /> : null;
    default:
      return (
        <>
          <WidgetHeader title={IModelApp.localization.getLocalizedString("ReportsWidget:ITwinReports")} />
          <div className="reports-table-container">
            <div className="table-toolbar">
              <Button
                startIcon={<SvgAdd />}
                onClick={async () => addReport()}
                styleType="high-visibility"
              >
                {IModelApp.localization.getLocalizedString("ReportsWidget:New")}
              </Button>
            </div>
            <Table<ReportType>
              data={reports}
              className="reports-table"
              density="extra-condensed"
              columns={reportsColumns}
              emptyTableContent={IModelApp.localization.getLocalizedString("ReportsWidget:NoReportsAvailable")}
              isSortable
              isLoading={isLoading}
              paginatorRenderer={LocalizedTablePaginator}
            />
          </div>
          <DeleteModal
            entityName={selectedReport?.displayName ?? ""}
            show={showDeleteModal}
            setShow={setShowDeleteModal}
            onDelete={async () => {
              const accessToken = (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
              const reportingClientApi = new ReportingClient();
              await reportingClientApi.deleteReport(
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
