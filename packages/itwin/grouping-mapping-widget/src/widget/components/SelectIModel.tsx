/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { EntityListIterator, IModel, IModelsClient } from "@itwin/imodels-client-management";
import type { TablePaginatorRendererProps } from "@itwin/itwinui-react";
import { Button, Table, tableFilters, TablePaginator } from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { CreateTypeFromInterface } from "../utils";
import "./SelectIModel.scss";
import type { GetAccessTokenFn } from "./context/GroupingApiConfigContext";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import { useIModelsClient } from "./context/IModelsClientContext";
import { handleError } from "./utils";

type IIModelTyped = CreateTypeFromInterface<IModel>;

const defaultDisplayStrings = {
  imodels: "iModels",
  imodelName: "Name",
  imodelDescription: "Description",
};

const fetchIModels = async (
  setIModels: React.Dispatch<React.SetStateAction<IModel[]>>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  getAccessToken: GetAccessTokenFn,
  itwinId: string,
  imodelsClient: IModelsClient,
) => {
  try {
    setIModels([]);
    setIsLoading(true);
    const imodelIterator: EntityListIterator<IModel> = imodelsClient.iModels.getRepresentationList({
      authorization: async () => {
        const token = await getAccessToken();
        const splitToken = token.split(" ");
        return {
          scheme: splitToken[0],
          token: splitToken[1],
        };
      },
      urlParams: {
        iTwinId: itwinId,
      },
    });
    const imodels: IModel[] = [];
    for await (const imodel of imodelIterator) {
      imodels.push(imodel);
    }
    setIModels(imodels);
  } catch (error: any) {
    handleError(error.status);
  } finally {
    setIsLoading(false);
  }
};

interface SelectIModelProps {
  itwinId: string;
  onSelect: (imodelId: string) => void;
  onCancel: () => void;
  backFn: () => void;
  displayStrings?: Partial<typeof defaultDisplayStrings>;
}
const SelectIModel = ({
  itwinId,
  onSelect,
  onCancel,
  backFn,
  displayStrings: userDisplayStrings,
}: SelectIModelProps) => {
  const { getAccessToken } = useGroupingMappingApiConfig();
  const imodelsClient = useIModelsClient();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [imodels, setIModels] = useState<IModel[]>([]);

  useEffect(() => {
    void fetchIModels(setIModels, setIsLoading, getAccessToken, itwinId, imodelsClient);
  }, [getAccessToken, imodelsClient, setIsLoading, itwinId]);

  const displayStrings = React.useMemo(
    () => ({ ...defaultDisplayStrings, ...userDisplayStrings }),
    [userDisplayStrings]
  );

  const imodelsColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "imodelName",
            Header: `${displayStrings.imodelName}`,
            accessor: "name",
            Filter: tableFilters.TextFilter(),
          },
          {
            id: "imodelDescription",
            Header: `${displayStrings.imodelDescription}`,
            accessor: "description",
            Filter: tableFilters.TextFilter(),
          },
        ],
      },
    ],
    [displayStrings.imodelName, displayStrings.imodelDescription]
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
        data={imodels}
        columns={imodelsColumns}
        className='gmw-select-imodel-table'
        emptyTableContent={`No ${displayStrings.imodels} available.`}
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
