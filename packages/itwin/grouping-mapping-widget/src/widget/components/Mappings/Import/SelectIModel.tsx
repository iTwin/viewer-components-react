/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { EntityListIterator, IModel, IModelsClient } from "@itwin/imodels-client-management";
import type { TablePaginatorRendererProps } from "@itwin/itwinui-react";
import { Button, Table, tableFilters, TablePaginator } from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { CreateTypeFromInterface } from "../../../utils";
import "./SelectIModel.scss";
import type { GetAccessTokenFn } from "../../context/GroupingApiConfigContext";
import { useGroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import { useIModelsClient } from "../../context/IModelsClientContext";
import { handleError } from "../../SharedComponents/utils";

type IIModelTyped = CreateTypeFromInterface<IModel>;

const defaultDisplayStrings = {
  iModels: "iModels",
  iModelName: "Name",
  iModelDescription: "Description",
};

const fetchIModels = async (
  setIModels: (iModels: IModel[]) => void,
  setIsLoading: (isLoading: boolean) => void,
  getAccessToken: GetAccessTokenFn,
  iTwinId: string,
  iModelsClient: IModelsClient,
) => {
  try {
    setIModels([]);
    setIsLoading(true);
    const iModelIterator: EntityListIterator<IModel> = iModelsClient.iModels.getRepresentationList({
      authorization: async () => {
        const token = await getAccessToken();
        const splitToken = token.split(" ");
        return {
          scheme: splitToken[0],
          token: splitToken[1],
        };
      },
      urlParams: {
        iTwinId,
      },
    });
    const iModels: IModel[] = [];
    for await (const iModel of iModelIterator) {
      iModels.push(iModel);
    }
    setIModels(iModels);
  } catch (error: any) {
    handleError(error.status);
  } finally {
    setIsLoading(false);
  }
};

interface SelectIModelProps {
  iTwinId: string;
  onSelect: (iModelId: string) => void;
  onCancel: () => void;
  backFn: () => void;
  displayStrings?: Partial<typeof defaultDisplayStrings>;
}
const SelectIModel = ({
  iTwinId: iTwinId,
  onSelect,
  onCancel,
  backFn,
  displayStrings: userDisplayStrings,
}: SelectIModelProps) => {
  const { getAccessToken } = useGroupingMappingApiConfig();
  const iModelsClient = useIModelsClient();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [iModels, setIModels] = useState<IModel[]>([]);

  useEffect(() => {
    void fetchIModels(setIModels, setIsLoading, getAccessToken, iTwinId, iModelsClient);
  }, [getAccessToken, iModelsClient, setIsLoading, iTwinId]);

  const displayStrings = React.useMemo(
    () => ({ ...defaultDisplayStrings, ...userDisplayStrings }),
    [userDisplayStrings]
  );

  const iModelsColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
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
      },
    ],
    [displayStrings.iModelName, displayStrings.iModelDescription]
  );

  const pageSizeList = useMemo(() => [10, 25, 50], []);
  const paginator = useCallback(
    (props: TablePaginatorRendererProps) => (
      <TablePaginator {...props} pageSizeList={pageSizeList} />
    ),
    [pageSizeList]
  );

  return (
    <div className='gmw-select-imodel-table-container'>
      <Table<IIModelTyped>
        data={iModels}
        columns={iModelsColumns}
        className='gmw-select-imodel-table'
        emptyTableContent={`No ${displayStrings.iModels} available.`}
        isSortable
        isLoading={isLoading}
        onRowClick={(_, row) => {
          onSelect(row.original.id);
        }}
        paginatorRenderer={paginator}
      />
      <div className='gmw-import-action-panel'>
        <Button onClick={backFn}>Back</Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
};

export default SelectIModel;
