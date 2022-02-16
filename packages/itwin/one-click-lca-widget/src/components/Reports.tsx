/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { useMemo, useState, useEffect } from "react";
import { SearchBox } from "@itwin/core-react";
import { IModelApp } from "@itwin/core-frontend";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { Button, Table } from "@itwin/itwinui-react";
import { ReportReportingAPI, ReportingClient } from "@itwin/insights-client";
import { WidgetHeader } from "./utils";
import ExportModal from "./ExportModal";
import "./Reports.scss";

type CreateTypeFromInterface<Interface> = {
  [Property in keyof Interface]: Interface[Property];
};

type Reporting = CreateTypeFromInterface<ReportReportingAPI>;

const Reports = () => {
  const projectId = useActiveIModelConnection()?.iTwinId as string;
  const reportingClientApi = new ReportingClient();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [reports, setReports] = useState<ReportReportingAPI[]>([]);
  const [buttonIsDisabled, disableButton] = useState<boolean>(true);
  const [filteredReports, setFilteredReports] =
    useState<ReportReportingAPI[]>(reports);
  const [selectedReport, setSelectedReport] = useState<Reporting>();

  const [modalIsOpen, openModal] = useState(false);

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
    },
    [buttonIsDisabled, selectedReport]
  );

  useEffect(() => {
    IModelApp.authorizationClient?.getAccessToken().then((token) => {
      reportingClientApi.getReports(token, projectId).then((data) => {
        if (data) {
          const fetchedReports = data.reports ?? [];
          setReports(fetchedReports);
          setFilteredReports(fetchedReports);
          setIsLoading(false);
        }
      });
    });
  }, [projectId]);

  return (
    <>
      <WidgetHeader title="Reports" />
      <div className="reports-container">
        <div className="searchbox-container">
          <SearchBox
            onValueChanged={onSearchBoxValueChanged}
            placeholder={"Search reports"}
          />
        </div>
        <div className="scrollable-table">
          <Table<Reporting>
            className="reports-table"
            data={filteredReports}
            density="extra-condensed"
            columns={reportsColumns}
            emptyTableContent="No reports available."
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
        className="button-center"
      >
        One Click LCA Export
      </Button>
      <ExportModal
        isOpen={modalIsOpen}
        close={() => openModal(false)}
        reportId={selectedReport?.id}
      />
    </>
  );
};

export default Reports;
