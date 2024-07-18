/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Anchor, Table, Text } from "@itwin/itwinui-react";
import { TableData } from "../PropertyTable/PropertyTable";
import { useMemo } from "react";
import { clearAll, getHiliteIdsWithElementIds, visualizeElements, zoomToElements } from "../viewerUtils";
import "./Results.scss";
export interface ResultsProps {
  tableData: TableData;
}

export const Results = ({ tableData }: ResultsProps) => {
  const columns = useMemo(
    () =>
      tableData.headers.map((header) => ({
        Header: header,
        accessor: header,
        width: 200,
        Cell: (props: any) =>
          props.column.Header === "ECInstanceId" ? (
            <Anchor
              onClick={async () => {
                const ECInstanceIdIndex = tableData.headers.indexOf("ECInstanceId");
                const ECInstanceIds = tableData.data.map((row) => row[ECInstanceIdIndex]);
                clearAll();
                console.log(props);
                const hiliteSet = await getHiliteIdsWithElementIds(ECInstanceIds);
                visualizeElements(hiliteSet, "red");
                const hiliteSetForElement = await getHiliteIdsWithElementIds([props.value]);
                await zoomToElements(hiliteSetForElement);
              }}
            >
              {props.value}
            </Anchor>
          ) : (
            <Text>{props.value}</Text>
          ),
      })),
    [],
  );

  return (
    <div className="results-table-container">
      <Table
        data={tableData.data.map((row) => Object.fromEntries(row.map((value, index) => [tableData.headers[index], value])))}
        density="extra-condensed"
        columns={columns}
        emptyTableContent={`No Extracted Validation Properties`}
        isSortable
      />
    </div>
  );
};
