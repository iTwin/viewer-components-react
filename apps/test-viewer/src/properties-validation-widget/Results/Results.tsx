/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Table } from "@itwin/itwinui-react";
import { TableData } from "../PropertyTable/PropertyTable";
import { useCallback, useMemo } from "react";

export interface ResultsProps {
  tableData: TableData;
}

interface ResultsTable {
  data: string;
}

export const Results = ({ tableData }: ResultsProps) => {
  const columns = useMemo(
    () => tableData.headers.map((header) => ({ Header: header, accessor: header, Cell: ({ value }: { value: string }) => <span>{value}</span> })),
    [],
  );

  return (
    <Table
      data={tableData.data.map((row) => Object.fromEntries(row.map((value, index) => [tableData.headers[index], value])))}
      density="extra-condensed"
      columns={columns}
      emptyTableContent={`No Extracted Validation Properties`}
      isSortable
    />
  );
};
