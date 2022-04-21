/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type {
  TablePaginatorRendererProps,
} from "@itwin/itwinui-react";
import {
  Button,
  Table,
  tableFilters,
  TablePaginator,
} from "@itwin/itwinui-react";
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Mapping } from "@itwin/insights-client";
import { ReportingClient } from "@itwin/insights-client";
import type { Api } from "./GroupingMapping";
import { ApiContext } from "./GroupingMapping";
import type { MappingType } from "./Mapping";
import "./SelectMapping.scss";
import { handleError } from "./utils";

const fetchMappings = async (
  setMappings: React.Dispatch<React.SetStateAction<Mapping[]>>,
  iModelId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  apiContext: Api
) => {
  try {
    setIsLoading(true);
    const reportingClientApi = new ReportingClient(apiContext.prefix);
    const mappings = await reportingClientApi.getMappings(apiContext.accessToken, iModelId);
    setMappings(mappings);
  } catch (error: any) {
    handleError(error.status);
  } finally {
    setIsLoading(false);
  }
};

interface SelectMappingsProps {
  iModelId: string;
  onSelect: (selectedMappings: MappingType[]) => void;
  onCancel: () => void;
  backFn: () => void;
}

const SelectMappings = ({
  iModelId,
  onSelect,
  onCancel,
  backFn,
}: SelectMappingsProps) => {
  const apiContext = useContext(ApiContext);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedMappings, setSelectedMappings] = useState<MappingType[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);

  useEffect(() => {
    void fetchMappings(setMappings, iModelId, setIsLoading, apiContext);
  }, [apiContext, iModelId, setIsLoading]);

  const mappingsColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "mappingName",
            Header: "Mapping Name",
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
      <Table<MappingType>
        data={mappings}
        columns={mappingsColumns}
        className='select-mapping-table'
        emptyTableContent='No Mappings available.'
        isSortable
        isSelectable
        isLoading={isLoading}
        onSelect={(selectData: MappingType[] | undefined) => {
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
