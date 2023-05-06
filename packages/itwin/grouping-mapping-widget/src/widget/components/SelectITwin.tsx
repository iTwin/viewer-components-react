/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ITwin, ITwinSubClass, ITwinsAPIResponse, ITwinsAccessClient } from "@itwin/itwins-client";
import { SvgCalendar, SvgList, SvgStarHollow } from "@itwin/itwinui-icons-react";
import { Button, HorizontalTabs, Tab, Table, TablePaginator, TablePaginatorRendererProps, tableFilters } from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CreateTypeFromInterface } from "../utils";
import "./SelectITwin.scss";
import { GetAccessTokenFn, useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import { useITwinsClient } from "./context/ITwinsClientContext";
import { handleError } from "./utils";

type IITwinTyped = CreateTypeFromInterface<ITwin>;

const defaultDisplayStrings = {
  itwins: "iTwins",
  itwinNumber: "Number",
  itwinName: "Name",
  itwinStatus: "Status",
};

const tabsWithIcons = [
  <Tab key="favorite" label="Favorite iTwins" startIcon={<SvgStarHollow />} />,
  <Tab key="recents" label="Recent iTwins" startIcon={<SvgCalendar />} />,
  <Tab key="all" label="My iTwins" startIcon={<SvgList />} />,
];

const fetchITwins = async (
  setITwins: React.Dispatch<React.SetStateAction<ITwin[]>>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  getAccessToken: GetAccessTokenFn,
  itwinsClient: ITwinsAccessClient,
  itwinType: number,
) => {
  try {
    setITwins([]);
    setIsLoading(true);
    const accessToken = await getAccessToken();
    let itwinsResponse: ITwinsAPIResponse<ITwin[]>;
    switch (itwinType) {
      case 0:
        itwinsResponse = await itwinsClient.queryFavoritesAsync(accessToken, ITwinSubClass.Project);
        break;
      case 1:
        itwinsResponse = await itwinsClient.queryRecentsAsync(accessToken, ITwinSubClass.Project);
        break;
      default:
        itwinsResponse = await itwinsClient.queryAsync(accessToken, ITwinSubClass.Project);
    }
    setITwins(itwinsResponse.data!);
  } catch (error: any) {
    handleError(error.status);
  } finally {
    setIsLoading(false);
  }
};

interface SelectITwinProps {
  onSelect: (itwinId: string) => void;
  onCancel: () => void;
  onChangeITwinType: (itwinType: number) => void;
  displayStrings?: Partial<typeof defaultDisplayStrings>;
  defaultITwinType?: number;
}
const SelectITwin = ({
  onSelect,
  onCancel,
  onChangeITwinType,
  displayStrings: userDisplayStrings,
  defaultITwinType = 0,
}: SelectITwinProps) => {
  const { getAccessToken } = useGroupingMappingApiConfig();
  const itwinsClient = useITwinsClient();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [itwins, setITwins] = useState<ITwin[]>([]);
  const [itwinType, setITwinType] = useState<number>(defaultITwinType);

  useEffect(() => {
    void fetchITwins(setITwins, setIsLoading, getAccessToken, itwinsClient, itwinType);
  }, [getAccessToken, itwinsClient, setIsLoading, itwinType]);

  const displayStrings = React.useMemo(
    () => ({ ...defaultDisplayStrings, ...userDisplayStrings }),
    [userDisplayStrings]
  );

  const itwinsColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "itwinNumber",
            Header: `${displayStrings.itwinNumber}`,
            accessor: "number",
            Filter: tableFilters.TextFilter(),
          },
          {
            id: "itwinName",
            Header: `${displayStrings.itwinName}`,
            accessor: "displayName",
            Filter: tableFilters.TextFilter(),
          },
          {
            id: "itwinStatus",
            Header: `${displayStrings.itwinStatus}`,
            accessor: "status",
            Filter: tableFilters.TextFilter(),
          },
        ],
      },
    ],
    [displayStrings.itwinNumber, displayStrings.itwinName, displayStrings.itwinStatus]
  );

  const pageSizeList = useMemo(() => [10, 25, 50], []);
  const paginator = useCallback(
    (props: TablePaginatorRendererProps) => (
      <TablePaginator {...props} pageSizeList={pageSizeList} />
    ),
    [pageSizeList]
  );

  return (
    <div className="gmw-select-itwin-table-container">
      <HorizontalTabs
        labels={tabsWithIcons}
        onTabSelected={(type) => {
          onChangeITwinType(type);
          setITwinType(type);
        }}
        activeIndex={itwinType}
        type={"borderless"}
        contentClassName="gmw-table-holding-tab">
      </HorizontalTabs>
      <div className="gmw-itwin-table">
        <Table<IITwinTyped>
          data={itwins}
          columns={itwinsColumns}
          className='gmw-select-itwin-table'
          emptyTableContent={`No ${displayStrings.itwins} available.`}
          isSortable
          isLoading={isLoading}
          onRowClick={(_, row) => {
            onSelect(row.original!.id!);
          }}
          paginatorRenderer={paginator}
        />
      </div>
      <div className="gmw-select-itwin-action-panel">
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
};

export default SelectITwin;
