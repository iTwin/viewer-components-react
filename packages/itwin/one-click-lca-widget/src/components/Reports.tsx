/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useEffect, useMemo, useState } from "react";
import { SearchBox } from "@itwin/core-react";
import { IModelApp } from "@itwin/core-frontend";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { Button, Table, toaster } from "@itwin/itwinui-react";
import type { Report } from "@itwin/insights-client";
import { WidgetHeader } from "./utils";
import ExportModal from "./ExportModal";
import "./Reports.scss";
import { useReportsClient } from "./context/ReportsClientContext";

type CreateTypeFromInterface<Interface> = {
  [Property in keyof Interface]: Interface[Property];
};

type Reporting = CreateTypeFromInterface<Report>;

/**
 * @internal
 */
export const Reports = () => {
  const projectId = useActiveIModelConnection()?.iTwinId as string;
  const reportsClient = useReportsClient();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [buttonIsDisabled, disableButton] = useState<boolean>(true);
  const [filteredReports, setFilteredReports] = useState<Report[]>(reports);
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
    [],
  );

  const onSearchBoxValueChanged = async (value: string) => {
    disableButton(true);
    const filterReports = reports.filter((x) => x.displayName && x.displayName.toLowerCase().indexOf(value.toLowerCase()) > -1);
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
    [buttonIsDisabled, selectedReport],
  );

  useEffect(() => {
    if (!IModelApp.authorizationClient) throw new Error("AuthorizationClient is not defined. Most likely IModelApp.startup was not called yet.");
    IModelApp.authorizationClient
      .getAccessToken()
      .then((token: string) => {
        reportsClient
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
  }, [projectId, reportsClient]);

  return (
    <>
      <WidgetHeader title="Reports" />
      <div className="oclca-reports-container">
        <div className="oclca-searchbox-container">
          <SearchBox onValueChanged={onSearchBoxValueChanged} placeholder={"Search reports"} />
        </div>
        <div className="oclca-scrollable-table">
          <Table<Reporting>
            className="oclca-reports-table"
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
      <Button onClick={() => openModal(true)} styleType="cta" disabled={buttonIsDisabled} className="oclca-button-center">
        One Click LCA Export
      </Button>
      <ExportModal isOpen={modalIsOpen} close={() => openModal(false)} reportId={selectedReport?.id} />
    </>
  );
};
