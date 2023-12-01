/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { ITwin, ITwinsAccessClient } from "@itwin/itwins-client";
import { ITwinSubClass } from "@itwin/itwins-client";
import { SvgCalendar, SvgList, SvgStarHollow } from "@itwin/itwinui-icons-react";
import type { TablePaginatorRendererProps } from "@itwin/itwinui-react";
import { Button, Tab, Table, tableFilters, TablePaginator, Tabs } from "@itwin/itwinui-react";
import React, { useCallback, useMemo, useState } from "react";
import type { CreateTypeFromInterface } from "../../../common/utils";
import "./SelectITwin.scss";
import type { GetAccessTokenFn } from "../../context/GroupingApiConfigContext";
import { useGroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import { useITwinsClient } from "../../context/ITwinsClientContext";
import { useQuery } from "@tanstack/react-query";
import type { Column } from "react-table";

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
  getAccessToken: GetAccessTokenFn,
  iTwinsClient: ITwinsAccessClient,
  iTwinType: number,
) => {
  const accessToken = await getAccessToken();
  switch (iTwinType) {
    case 0:
      return iTwinsClient.queryFavoritesAsync(accessToken, ITwinSubClass.Project);
    case 1:
      return iTwinsClient.queryRecentsAsync(accessToken, ITwinSubClass.Project);
    default:
      return iTwinsClient.queryAsync(accessToken, ITwinSubClass.Project);
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
  const [iTwinType, setITwinType] = useState<number>(defaultITwinType);

  const { data: iTwins, isFetching: isLoading } = useQuery({
    queryKey: ["iTwin", iTwinType],
    queryFn: async () => (await fetchITwins(getAccessToken, iTwinsClient, iTwinType)).data!,
  });

  const displayStrings = React.useMemo(
    () => ({ ...defaultDisplayStrings, ...userDisplayStrings }),
    [userDisplayStrings]
  );

  const iTwinsColumns = useMemo<Column<IITwinTyped>[]>(
    () => [
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
      <Tabs
        orientation="horizontal"
        labels={tabsWithIcons}
        onTabSelected={(type) => {
          onChangeITwinType(type);
          setITwinType(type);
        }}
        activeIndex={iTwinType}
        type={"borderless"}
        contentClassName="gmw-table-holding-tab">
      </Tabs>
      <Table<IITwinTyped>
        data={iTwins ?? []}
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
