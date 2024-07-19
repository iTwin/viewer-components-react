/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Anchor, Table, Text } from "@itwin/itwinui-react";
import { TableData } from "../PropertyTable/PropertyTable";
import { useEffect, useMemo } from "react";
import { clearAll, getHiliteIdsWithElementIds, visualizeElements, zoomToElements } from "../viewerUtils";
import "./Results.scss";
export interface ResultsProps {
  tableData: TableData;
}

export const Results = ({ tableData }: ResultsProps) => {
  useEffect(() => {
    const ECInstanceIdIndex = tableData.headers.indexOf("ECInstanceId");
    clearAll();

    const heatmapRowsByResult = async () => {
      const trueRows = tableData.data.filter((row) => row.some((value) => value === "true" && !row.some((value) => value === "false")));
      const falseRows = tableData.data.filter((row) => row.some((value) => value === "false" && !row.some((value) => value === "true")));
      const mixedRows = tableData.data.filter((row) => row.some((value) => value === "true" && row.some((value) => value === "false")));
      const trueECInstanceIds = trueRows.map((row) => row[ECInstanceIdIndex]);
      const falseECInstanceIds = falseRows.map((row) => row[ECInstanceIdIndex]);
      const mixedECInstanceIds = mixedRows.map((row) => row[ECInstanceIdIndex]);
      const trueHiliteSet = await getHiliteIdsWithElementIds(trueECInstanceIds);
      const falseHiliteSet = await getHiliteIdsWithElementIds(falseECInstanceIds);
      const mixedHiliteSet = await getHiliteIdsWithElementIds(mixedECInstanceIds);
      visualizeElements(trueHiliteSet, "green");
      visualizeElements(falseHiliteSet, "red");
      visualizeElements(mixedHiliteSet, "yellow");
    };

    heatmapRowsByResult();
  }, []);

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
