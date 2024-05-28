/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { IModel, IModelsClient } from "@itwin/imodels-client-management";
import type { TablePaginatorRendererProps } from "@itwin/itwinui-react";
import { Button, Table, tableFilters, TablePaginator } from "@itwin/itwinui-react";
import React, { useCallback, useMemo } from "react";
import type { CreateTypeFromInterface } from "../../../common/utils";
import "./SelectIModel.scss";
import type { GetAccessTokenFn } from "../../context/GroupingApiConfigContext";
import { useGroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import { useIModelsClient } from "../../context/IModelsClientContext";
import { useQuery } from "@tanstack/react-query";
import type { Column } from "react-table";
import { AccessTokenAdapter } from "@itwin/imodels-access-frontend";

type IIModelTyped = CreateTypeFromInterface<IModel>;

const defaultDisplayStrings = {
  iModels: "iModels",
  iModelName: "Name",
  iModelDescription: "Description",
};

const fetchIModels = async (getAccessToken: GetAccessTokenFn, iTwinId: string, iModelsClient: IModelsClient) => {
  const accessToken = await getAccessToken();
  const authorization = AccessTokenAdapter.toAuthorizationCallback(accessToken);
  const iModelIterator = iModelsClient.iModels.getRepresentationList({
    authorization,
    urlParams: {
      iTwinId,
    },
  });

  const iModels = [];
  for await (const iModel of iModelIterator) {
    iModels.push(iModel);
  }
  return iModels;
};

interface SelectIModelProps {
  iTwinId: string;
  onSelect: (iModelId: string) => void;
  onCancel: () => void;
  backFn: () => void;
  displayStrings?: Partial<typeof defaultDisplayStrings>;
}
const SelectIModel = ({ iTwinId: iTwinId, onSelect, onCancel, backFn, displayStrings: userDisplayStrings }: SelectIModelProps) => {
  const { getAccessToken } = useGroupingMappingApiConfig();
  const iModelsClient = useIModelsClient();

  const { data: iModels, isFetching: isLoading } = useQuery({
    queryKey: ["iModels", iTwinId],
    queryFn: async () => fetchIModels(getAccessToken, iTwinId, iModelsClient),
  });

  const displayStrings = React.useMemo(() => ({ ...defaultDisplayStrings, ...userDisplayStrings }), [userDisplayStrings]);

  const iModelsColumns = useMemo<Column<IIModelTyped>[]>(
    () => [
      {
        id: "iModelName",
        Header: `${displayStrings.iModelName}`,
        accessor: "name",
        Filter: tableFilters.TextFilter(),
      },
      {
        id: "iModelDescription",
        Header: `${displayStrings.iModelDescription}`,
        accessor: "description",
        Filter: tableFilters.TextFilter(),
      },
    ],
    [displayStrings.iModelName, displayStrings.iModelDescription],
  );

  const pageSizeList = useMemo(() => [10, 25, 50], []);
  const paginator = useCallback((props: TablePaginatorRendererProps) => <TablePaginator {...props} pageSizeList={pageSizeList} />, [pageSizeList]);

  return (
    <div className="gmw-select-imodel-table-container">
      <Table<IIModelTyped>
        data={iModels ?? []}
        columns={iModelsColumns}
        className="gmw-select-imodel-table"
        emptyTableContent={`No ${displayStrings.iModels} available.`}
        isSortable
        isLoading={isLoading}
        onRowClick={(_, row) => {
          onSelect(row.original.id);
        }}
        paginatorRenderer={paginator}
      />
      <div className="gmw-import-action-panel">
        <Button onClick={backFn}>Back</Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
};

export default SelectIModel;
