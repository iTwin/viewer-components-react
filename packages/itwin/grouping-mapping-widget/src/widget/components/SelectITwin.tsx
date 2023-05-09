/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { ITwin, ITwinsAccessClient, ITwinsAPIResponse } from "@itwin/itwins-client";
import { ITwinSubClass } from "@itwin/itwins-client";
import { SvgCalendar, SvgList, SvgStarHollow } from "@itwin/itwinui-icons-react";
import type { TablePaginatorRendererProps } from "@itwin/itwinui-react";
import { Button, HorizontalTabs, Tab, Table, tableFilters, TablePaginator } from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { CreateTypeFromInterface } from "../utils";
import "./SelectITwin.scss";
import type { GetAccessTokenFn } from "./context/GroupingApiConfigContext";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import { useITwinsClient } from "./context/ITwinsClientContext";
import { handleError } from "./utils";

type IITwinTyped = CreateTypeFromInterface<ITwin>;

const defaultDisplayStrings = {
  iTwins: "iTwins",
  iTwinNumber: "Number",
  iTwinName: "Name",
  iTwinStatus: "Status",
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
  iTwinsClient: ITwinsAccessClient,
  iTwinType: number,
) => {
  try {
    setITwins([]);
    setIsLoading(true);
    const accessToken = await getAccessToken();
    let iTwinsResponse: ITwinsAPIResponse<ITwin[]>;
    switch (iTwinType) {
      case 0:
        iTwinsResponse = await iTwinsClient.queryFavoritesAsync(accessToken, ITwinSubClass.Project);
        break;
      case 1:
        iTwinsResponse = await iTwinsClient.queryRecentsAsync(accessToken, ITwinSubClass.Project);
        break;
      default:
        iTwinsResponse = await iTwinsClient.queryAsync(accessToken, ITwinSubClass.Project);
    }
    setITwins(iTwinsResponse.data!);
  } catch (error: any) {
    handleError(error.status);
  } finally {
    setIsLoading(false);
  }
};

interface SelectITwinProps {
  onSelect: (iTwinId: string) => void;
  onCancel: () => void;
  onChangeITwinType: (iTwinType: number) => void;
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
  const iTwinsClient = useITwinsClient();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [iTwins, setITwins] = useState<ITwin[]>([]);
  const [iTwinType, setITwinType] = useState<number>(defaultITwinType);

  useEffect(() => {
    void fetchITwins(setITwins, setIsLoading, getAccessToken, iTwinsClient, iTwinType);
  }, [getAccessToken, iTwinsClient, setIsLoading, iTwinType]);

  const displayStrings = React.useMemo(
    () => ({ ...defaultDisplayStrings, ...userDisplayStrings }),
    [userDisplayStrings]
  );

  const iTwinsColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "iTwinNumber",
            Header: `${displayStrings.iTwinNumber}`,
            accessor: "number",
            Filter: tableFilters.TextFilter(),
          },
          {
            id: "iTwinName",
            Header: `${displayStrings.iTwinName}`,
            accessor: "displayName",
            Filter: tableFilters.TextFilter(),
          },
          {
            id: "iTwinStatus",
            Header: `${displayStrings.iTwinStatus}`,
            accessor: "status",
            Filter: tableFilters.TextFilter(),
          },
        ],
      },
    ],
    [displayStrings.iTwinNumber, displayStrings.iTwinName, displayStrings.iTwinStatus]
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
        activeIndex={iTwinType}
        type={"borderless"}
        contentClassName="gmw-table-holding-tab">
      </HorizontalTabs>
      <Table<IITwinTyped>
        data={iTwins}
        columns={iTwinsColumns}
        className='gmw-select-itwin-table'
        emptyTableContent={`No ${displayStrings.iTwins} available.`}
        isSortable
        isLoading={isLoading}
        onRowClick={(_, row) => {
          onSelect(row.original.id!);
        }}
        paginatorRenderer={paginator}
      />
      <div className="gmw-import-action-panel">
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
};

export default SelectITwin;
