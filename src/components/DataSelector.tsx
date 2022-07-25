/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { SearchBox } from "@itwin/core-react";
import { IModelApp } from "@itwin/core-frontend";
import { GroupItem, useActiveIModelConnection } from "@itwin/appui-react";
import { Button, Table, toaster } from "@itwin/itwinui-react";
import type { Report } from "@itwin/insights-client";
import { ReportingClient } from "@itwin/insights-client";
import { WidgetHeader } from "./utils";
import { ODataItem } from "@itwin/insights-client";
import { ODataResponse } from "@itwin/insights-client";
import { Group } from "@itwin/insights-client";
import { ReportSingle } from "@itwin/insights-client";
import ExportModal from "./ExportModal";
import { ECProperty } from "@itwin/insights-client";
import Items from "./Items";
import "./Reports.scss";

type CreateTypeFromInterface<Interface> = {
  [Property in keyof Interface]: Interface[Property];
};

//type GroupItem = CreateTypeFromInterface<Group>;
//type Reporting = CreateTypeFromInterface<Report>;

//type odataItem = CreateTypeFromInterface<ODataItem>;
type groupItem = CreateTypeFromInterface<Group>;

interface SelectorProps {
  reportId: string;
  reportName: string;
  goBack: () => Promise<void>;
}

interface Prop {
  Name: string,
  Value: string,
}

enum GroupView {
  GROUPS = "groups",
  ITEMS = "items",
}

type PropertyItem = CreateTypeFromInterface<ECProperty>


async function fetchResponse(token: string, reportingClientApi: ReportingClient, reportId: string) {
  return (await reportingClientApi.getODataReportMetadata(token, reportId)).text();
}

async function fetchMetadata(token: string, reportingClientApi: ReportingClient, reportId: string, ODataItem: ODataItem) {
  return reportingClientApi.getODataReportEntity(token, reportId, ODataItem);
}


const DataSelector = (props: SelectorProps) => {


  const reportingClientApi = useMemo(() => new ReportingClient(), []);
  const [selectedGroup, setSelectedGroup] = useState<groupItem>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [reportGroups, setGroups] = useState<groupItem[]>([]);
  const [groupView, setGroupView] = useState<GroupView>(
    GroupView.GROUPS
  );


  //const [properties, setProperties] = useState<PropertyItem[]>([]);
  //const [items, setItems] = useState<Report[]>([]);
  //const [buttonIsDisabled, disableButton] = useState<boolean>(true);
  //const [filteredItems, setFilteredItems] = useState<Report[]>(items);
  //const [selectedReport, setSelectedReport] = useState<Reporting>();

  //const [modalIsOpen, openModal] = useState(false);



  const propertyColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "ecPropertyName",
            Header: "ecPropertyName",
            accessor: "ecPropertyName",
          },
          {
            id: "ecPropertyType",
            Header: "ecPropertyType",
            accessor: "ecPropertyType",
          },
        ],
      },
    ],
    []
  );


  const groupColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "groupName",
            Header: "GroupName",
            accessor: "groupName",
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

  const onGroupRowClick = useMemo(
    () => (_: any, row: any) => {
      if (row.original === selectedGroup) {
        row.toggleRowSelected();
      } else {
        row.toggleRowSelected(true);
      }
      setSelectedGroup(row.original);
      setGroupView(GroupView.ITEMS);
    },
    [selectedGroup]
  );


  const load = (() => {
    setIsLoading(true);

    if (!IModelApp.authorizationClient)
      throw new Error(
        "AuthorizationClient is not defined. Most likely IModelApp.startup was not called yet."
      );
    if (!props.reportId)
      throw new Error(
        "Invalid report."
      );

    IModelApp.authorizationClient
      .getAccessToken()
      .then((token: string) => {
        reportingClientApi
          .getODataReport(token, props.reportId)
          .then(async (data) => {
            if (data) {


              const reportData = data ?? "";
              const groupItems = reportData.value.map(data => {
                return { groupName: data.name, description: data.url }
              });
              setGroups(groupItems);
            }
          })
          .catch((err) => {

            toaster.negative("You are not authorized to get metadata for this report. Please contact project administrator.");
            /* eslint-disable no-console */
            console.error(err);
          });
      })
      .catch((err) => {
        toaster.negative("You are not authorized to use this system.");
        /* eslint-disable no-console */
        console.error(err);
      });

    setIsLoading(false);
  })



  useEffect(() => {
    load();

  }, [reportingClientApi]);



  const refresh = useCallback(async () => {
    load();
  }, []);



  switch (groupView) {

    case GroupView.GROUPS:
      return (
        <>
          <WidgetHeader
            title={props.reportName ?? "Report"}
            returnFn={async () => {
              await props.goBack();
            }}
          />
          <div className="e_c_3-reports-container">
            <div className="e_c_3-scrollable-table">
              <Table<groupItem>
                className="e_c_3-reports-table"
                data={reportGroups}
                density="extra-condensed"
                columns={groupColumns}
                emptyTableContent="No items available."
                onRowClick={onGroupRowClick}
                isSortable
                isLoading={isLoading}
                selectRowOnClick={true}
                selectSubRows={false}
              />
            </div>
          </div>
        </>
      );

    case GroupView.ITEMS:
      return (
        <Items
          groupName={selectedGroup?.groupName ?? ""}
          url={selectedGroup?.description ?? ""}
          reportId={props.reportId}
          goBack={async () => {
            setGroupView(GroupView.GROUPS);
            await refresh();
          }}
        />
      );

    default:
      return (
        <a>opa</a>
      );
  };
}

export default DataSelector;
