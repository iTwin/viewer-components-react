/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SearchBox } from "@itwin/core-react";
import { IModelApp } from "@itwin/core-frontend";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { Button, Label, Table, toaster } from "@itwin/itwinui-react";
import type { Report } from "@itwin/insights-client";
import { ReportingClient } from "@itwin/insights-client";
import { WidgetHeader } from "./utils";
import ExportModal from "./ExportModal";
import { clearAll } from "./viewerUtils";
import DataSelector from "./DataSelector";
import "./Reports.scss";
import GroupSelector from "./GroupSelector";

type CreateTypeFromInterface<Interface> = {
  [Property in keyof Interface]: Interface[Property];
};

type Reporting = CreateTypeFromInterface<Report>;

enum ReportView {
  REPORTS = "reports",
  GROUPS = "groups",
}

const Reports = () => {
  const projectId = useActiveIModelConnection()?.iTwinId as string;
  const reportingClientApi = useMemo(() => new ReportingClient(), []);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [buttonIsDisabled, disableButton] = useState<boolean>(true);
  const [filteredReports, setFilteredReports] = useState<Report[]>(reports);
  const [selectedReport, setSelectedReport] = useState<Reporting>();
  const [reportView, setReportView] = useState<ReportView>(
    ReportView.REPORTS
  );

  const [modalIsOpen, openModal] = useState(false);

  const refresh = useCallback(async () => {
    clearAll();
    setReportView(ReportView.REPORTS);
    setSelectedReport(undefined);
    setReports([]);

    if (!IModelApp.authorizationClient)
      throw new Error(
        "AuthorizationClient is not defined. Most likely IModelApp.startup was not called yet."
      );
    IModelApp.authorizationClient
      .getAccessToken()
      .then((token: string) => {
        reportingClientApi
          .getReports(token, projectId)
          .then((data) => {
            if (data) {
              const fetchedReports = data ?? [];
              setReports(fetchedReports);
              setFilteredReports(fetchedReports);
              setIsLoading(false);
            }
          })
          .catch((err) => {
            setIsLoading(false);
            toaster.negative("You are not authorized to get reports for this projects. Please contact project administrator.");
            /* eslint-disable no-console */
            console.error(err);
          });
      })
      .catch((err) => {
        toaster.negative("You are not authorized to use this system.");
        /* eslint-disable no-console */
        console.error(err);
      });

  }, []);

  const reportsColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "displayName",
            Header: "Name",
            accessor: "displayName",
          },
          {
            id: "description",
            Header: "Description",
            accessor: "description",
          },
        ],
      },
    ],
    []
  );

  const onSearchBoxValueChanged = async (value: string) => {
    disableButton(true);
    const filterReports = reports.filter(
      (x) =>
        x.displayName &&
        x.displayName.toLowerCase()?.indexOf(value.toLowerCase()) > -1
    );
    setFilteredReports(filterReports);
  };

  const tableStateSingleSelectReducer = (newState: any, action: any): any => {
    switch (action.type) {
      case "toggleRowSelected": {
        return { ...newState, selectedRowIds: { [action.id]: action.value } };
      }
      default:
        break;
    }
    return newState;
  };

  const onReportRowClick = useMemo(
    () => (_: any, row: any) => {
      if (row.original === selectedReport) {
        disableButton(!buttonIsDisabled);
        row.toggleRowSelected();
      } else {
        disableButton(false);
        row.toggleRowSelected(true);
      }
      setSelectedReport(row.original);
      setReportView(ReportView.GROUPS);
    },
    [buttonIsDisabled, selectedReport]
  );

  useEffect(() => {
    if (!IModelApp.authorizationClient)
      throw new Error(
        "AuthorizationClient is not defined. Most likely IModelApp.startup was not called yet."
      );
    IModelApp.authorizationClient
      .getAccessToken()
      .then((token: string) => {
        reportingClientApi
          .getReports(token, projectId)
          .then((data) => {
            if (data) {
              const fetchedReports = data ?? [];
              setReports(fetchedReports);
              setFilteredReports(fetchedReports);
              setIsLoading(false);
            }
          })
          .catch((err) => {
            setIsLoading(false);
            toaster.negative("You are not authorized to get reports for this projects. Please contact project administrator.");
            /* eslint-disable no-console */
            console.error(err);
          });
      })
      .catch((err) => {
        toaster.negative("You are not authorized to use this system.");
        /* eslint-disable no-console */
        console.error(err);
      });
  }, [projectId, reportingClientApi]);



  switch (reportView) {

    case ReportView.REPORTS:
      return (
        <>
          <WidgetHeader title="Reports" />
          <div className="e_c_3-reports-container">
            <div className="e_c_3-searchbox-container">
              <SearchBox
                onValueChanged={onSearchBoxValueChanged}
                placeholder={"Search reports"}
              />
            </div>
            <div className="e_c_3-scrollable-table">
              <Table<Reporting>
                className="e_c_3-reports-table"
                data={filteredReports}
                density="extra-condensed"
                columns={reportsColumns}
                emptyTableContent="No items available."
                isSortable
                onRowClick={onReportRowClick}
                stateReducer={tableStateSingleSelectReducer}
                isLoading={isLoading}
                selectRowOnClick={true}
                selectSubRows={false}
              />
            </div>
          </div>
          <Button
            onClick={() => openModal(true)}
            styleType="cta"
            disabled={buttonIsDisabled}
            className="e_c_3-button-center"
          >
            E C 3 Export
          </Button>
          <ExportModal
            isOpen={modalIsOpen}
            close={() => openModal(false)}
            reportId={selectedReport?.id}
          />
        </>
      );

    default:
      return (
        <a>opa</a>
      );
  };

}

export default Reports;
