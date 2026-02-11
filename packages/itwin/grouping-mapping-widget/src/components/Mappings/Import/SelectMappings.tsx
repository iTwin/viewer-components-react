/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { TablePaginatorRendererProps } from "@itwin/itwinui-react";
import { Button, Table, tableFilters, TablePaginator } from "@itwin/itwinui-react";
import React, { useCallback, useMemo, useState } from "react";
import { GroupingMappingWidget } from "../../../GroupingMappingWidget";
import { useMappingClient } from "../../context/MappingClientContext";
import type { IMappingTyped } from "../Mappings";
import "./SelectMapping.scss";
import { useGroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import { useFetchMappings } from "../hooks/useFetchMappings";
import type { Column } from "react-table";

const getDefaultDisplayStrings = () => ({
  mappings: GroupingMappingWidget.translate("mappings.mappings"),
});

interface SelectMappingsProps {
  iModelId: string;
  onSelect: (selectedMappings: IMappingTyped[]) => void;
  onCancel: () => void;
  backFn: () => void;
  displayStrings?: Partial<ReturnType<typeof getDefaultDisplayStrings>>;
}

const SelectMappings = ({ iModelId, onSelect, onCancel, backFn, displayStrings: userDisplayStrings }: SelectMappingsProps) => {
  const { getAccessToken } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const [selectedMappings, setSelectedMappings] = useState<IMappingTyped[]>([]);

  const { data: mappings, isFetching: isLoading } = useFetchMappings(iModelId, getAccessToken, mappingClient);

  const displayStrings = React.useMemo(() => ({ ...getDefaultDisplayStrings(), ...userDisplayStrings }), [userDisplayStrings]);

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
        Header: GroupingMappingWidget.translate("common.description"),
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
        emptyTableContent={GroupingMappingWidget.translate("import.noMappings", { mappings: displayStrings.mappings })}
        isSortable
        isSelectable
        isLoading={isLoading}
        onSelect={(selectData: IMappingTyped[] | undefined) => {
          selectData && setSelectedMappings(selectData);
        }}
        paginatorRenderer={paginator}
      />
      <div className="gmw-import-action-panel">
        <Button onClick={backFn}>{GroupingMappingWidget.translate("common.back")}</Button>
        <Button
          styleType="high-visibility"
          onClick={() => {
            onSelect(selectedMappings);
          }}
          disabled={isLoading || selectedMappings.length === 0}
        >
          {GroupingMappingWidget.translate("common.next")}
        </Button>
        <Button onClick={onCancel}>{GroupingMappingWidget.translate("common.cancel")}</Button>
      </div>
    </div>
  );
};

export default SelectMappings;
