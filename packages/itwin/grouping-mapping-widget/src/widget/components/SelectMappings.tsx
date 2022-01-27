/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  Button,
  Table,
  tableFilters,
  TablePaginator,
  TablePaginatorRendererProps,
} from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MappingReportingAPI } from "../../api/generated/api";
import { reportingClientApi } from "../../api/reportingClient";
import { Mapping } from "./Mapping";
import "./SelectMapping.scss";

const fetchMappings = async (
  setMappings: React.Dispatch<React.SetStateAction<MappingReportingAPI[]>>,
  iModelId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
) => {
  try {
    setIsLoading(true);
    const mappings = await reportingClientApi.getMappings(iModelId);
    setMappings(mappings);
  } catch {
  } finally {
    setIsLoading(false);
  }
};

const useFetchMappings = (
  iModelId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
): [
  MappingReportingAPI[],
  React.Dispatch<React.SetStateAction<MappingReportingAPI[]>>
] => {
  const [mappings, setMappings] = useState<MappingReportingAPI[]>([]);
  useEffect(() => {
    void fetchMappings(setMappings, iModelId, setIsLoading);
  }, [iModelId, setIsLoading]);

  return [mappings, setMappings];
};

interface SelectMappingsProps {
  iModelId: string;
  onSelect: (selectedMappings: Mapping[]) => void;
  onCancel: () => void;
  backFn: () => void;
}

const SelectMappings = ({
  iModelId,
  onSelect,
  onCancel,
  backFn,
}: SelectMappingsProps) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mappings] = useFetchMappings(iModelId, setIsLoading);
  const [selectedMappings, setSelectedMappings] = useState<Mapping[]>([]);

  const mappingsColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "mappingName",
            Header: "Mapping",
            accessor: "mappingName",
            Filter: tableFilters.TextFilter(),
          },
          {
            id: "description",
            Header: "Description",
            accessor: "description",
            Filter: tableFilters.TextFilter(),
          },
        ],
      },
    ],
    []
  );

  const pageSizeList = useMemo(() => [10, 25, 50], []);
  const paginator = useCallback(
    (props: TablePaginatorRendererProps) => (
      <TablePaginator {...props} pageSizeList={pageSizeList} />
    ),
    [pageSizeList]
  );

  return (
    <div className='select-mapping-container'>
      <Table<Mapping>
        data={mappings}
        columns={mappingsColumns}
        className='select-mapping-table'
        emptyTableContent='No Mappings available.'
        isSortable
        isSelectable
        isLoading={isLoading}
        onSelect={(selectData: Mapping[] | undefined) => {
          selectData && setSelectedMappings(selectData);
        }}
        paginatorRenderer={paginator}
      />
      <div className='import-action-panel'>
        <Button onClick={backFn}>Back</Button>
        <Button
          styleType='high-visibility'
          onClick={() => {
            onSelect(selectedMappings);
          }}
          disabled={isLoading || selectedMappings.length === 0}
        >
          Next
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
};

export default SelectMappings;
