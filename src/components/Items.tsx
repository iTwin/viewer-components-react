/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useEffect, useMemo, useState, Dispatch } from "react";
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
import "./Reports.scss";

type CreateTypeFromInterface<Interface> = {
  [Property in keyof Interface]: Interface[Property];
};

type groupItem = CreateTypeFromInterface<Group>;

interface GroupProps {
  groupName: string;
  url: string;
  reportId: string;
  goBack: () => Promise<void>;
}

interface metaData {
  [key: string]: string,
}

type metaDataItem = CreateTypeFromInterface<metaData>


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


const GroupItems = (props: GroupProps) => {


  const reportingClientApi = useMemo(() => new ReportingClient(), []);

  const [groupItems, setItems] = useState<metaDataItem[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [reportProperties, setProperties] = useState<PropertyItem[]>([]);
  const [groupView, setGroupView] = useState<GroupView>(
    GroupView.GROUPS
  );


  const propertyColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "ecPropertyName",
            Header: "UserLabel",
            accessor: "ecPropertyName",
          },
          {
            id: "ecPropertyType",
            Header: "EC class Id",
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

  const itemColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "key",
            Header: "Key",
            accessor: "key",
          },
          {
            id: "value",
            Header: "Value",
            accessor: "value",
          },
        ],
      },
    ],
    []
  );



  useEffect(() => {

    setIsLoading(true);

    if (!IModelApp.authorizationClient)
      throw new Error(
        "AuthorizationClient is not defined. Most likely IModelApp.startup was not called yet."
      );
    if (!props.url)
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


              /*
              const responseText = await fetchResponse(token, reportingClientApi, props.reportId);
              const dom = new DOMParser().parseFromString(responseText, "text/xml");
              const elems = dom.getElementsByTagName("Property");
              const cols = Array.from(elems).map(e => {
                return { ecPropertyName: e.attributes[0].textContent ?? "", ecPropertyType: e.attributes[1].textContent ?? "" }
              });
              setProperties(cols);
              */

              //IDEJA: foreach data value fetch metadata

              //!!!!!!!!!

              /*
              const allData = data.value.flatMap(async m => {
                return { metadata: await fetchMetadata(token, reportingClientApi, props.reportId, m) }
              });

              console.log("");
              */

              data.value.filter(x => x.name == props.groupName).forEach(async element => {

                const metadata = await fetchMetadata(token, reportingClientApi, props.reportId, element)

                /*
                for (const key in metadata) {
                  const value = metadata ? [key] : "";
                }
                */

                const val = metadata?.map(m => {
                  return { ecPropertyName: m.UserLabel, ecPropertyType: m.ECClassId }
                }) ?? [];

                setProperties(val);

                console.log(metadata);


                //console.log("");
                /*
                metadata?.forEach(m => {
                  return { m }
                })

                if (metadata != undefined)
                  setItems(metadata);

                  */
                //console.log("");

              });


              //const responseText = await fetchMetadata(token, reportingClientApi, props.reportId);
              //const dom = new DOMParser().parseFromString(responseText, "text/xml");
              //const elems = dom.getElementsByTagName("Property");
              //const cols = Array.from(elems).map(e => {
              //  return { ecPropertyName: e.attributes[0].textContent ?? "", ecPropertyType: e.attributes[1].textContent ?? "" }
              //});
              //setProperties(cols);

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

  }, [reportingClientApi]);

  const onLoad = (() => {
    console.log("opa");
  });

  const validateContent = (() => {
    if (reportProperties.length == 0) {
      return "No items available.";
    }
    else {
      setIsLoading(true);
    }
  });

  return (
    <>
      <WidgetHeader
        title={props.groupName ?? "Group"}
        returnFn={async () => {
          await props.goBack();
        }}
      />
      <div className="e_c_3-reports-container">
        <div className="e_c_3-scrollable-table">
          <Table<PropertyItem>
            className="e_c_3-reports-table"
            data={reportProperties}
            density="extra-condensed"
            columns={propertyColumns}
            emptyTableContent={validateContent}
            isSortable
            isLoading={isLoading}
            selectRowOnClick={true}
            selectSubRows={false}
          />
        </div>
      </div>
    </>
  );
}

export default GroupItems;
