/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { TablePaginatorRendererProps } from "@itwin/itwinui-react";
import { Button, Table, tableFilters, TablePaginator } from "@itwin/itwinui-react";
import React, { useCallback, useMemo, useState } from "react";
import { useMappingClient } from "../../context/MappingClientContext";
import type { IMappingTyped } from "../Mappings";
import "./SelectMapping.scss";
import { useGroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import { useFetchMappings } from "../hooks/useFetchMappings";
import type { Column } from "react-table";

const defaultDisplayStrings = {
  mappings: "Mappings",
};

interface SelectMappingsProps {
  iModelId: string;
  onSelect: (selectedMappings: IMappingTyped[]) => void;
  onCancel: () => void;
  backFn: () => void;
  displayStrings?: Partial<typeof defaultDisplayStrings>;
}

const SelectMappings = ({ iModelId, onSelect, onCancel, backFn, displayStrings: userDisplayStrings }: SelectMappingsProps) => {
  const { getAccessToken } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const [selectedMappings, setSelectedMappings] = useState<IMappingTyped[]>([]);

  const { data: mappings, isFetching: isLoading } = useFetchMappings(iModelId, getAccessToken, mappingClient);

  const displayStrings = React.useMemo(() => ({ ...defaultDisplayStrings, ...userDisplayStrings }), [userDisplayStrings]);

  const mappingsColumns = useMemo<Column<IMappingTyped>[]>(
    () => [
      {
        id: "mappingName",
        Header: `${displayStrings.mappings}`,
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
    [displayStrings.mappings],
  );

  const pageSizeList = useMemo(() => [10, 25, 50], []);
  const paginator = useCallback((props: TablePaginatorRendererProps) => <TablePaginator {...props} pageSizeList={pageSizeList} />, [pageSizeList]);

  return (
    <div className="gmw-select-mapping-container">
      <Table<IMappingTyped>
        data={mappings ?? []}
        columns={mappingsColumns}
        className="gmw-select-mapping-table"
        emptyTableContent={`No ${displayStrings.mappings} available.`}
        isSortable
        isSelectable
        isLoading={isLoading}
        onSelect={(selectData: IMappingTyped[] | undefined) => {
          selectData && setSelectedMappings(selectData);
        }}
        paginatorRenderer={paginator}
      />
      <div className="gmw-import-action-panel">
        <Button onClick={backFn}>Back</Button>
        <Button
          styleType="high-visibility"
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
