/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  SvgAdd,
  SvgDelete,
  SvgEdit,
  SvgMore,
  SvgRefresh,
} from "@itwin/itwinui-icons-react";
import {
  Button,
  DropdownMenu,
  IconButton,
  MenuItem,
  Table,
} from "@itwin/itwinui-react";
import React, { useMemo, useState } from "react";
import type { CreateTypeFromInterface } from "../utils";
import type { CellProps } from "react-table";
import DeleteModal from "./DeleteModal";
import type { GroupProperty } from "@itwin/insights-client";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import { useMappingClient } from "./context/MappingClientContext";
import "./GroupPropertyTable.scss";

type IGroupPropertyTyped = CreateTypeFromInterface<GroupProperty>;

interface GroupPropertyTableProps {
  iModelId: string;
  mappingId: string;
  groupId: string;
  onClickAddGroupProperty?: () => void;
  onClickModifyGroupProperty?: (value: GroupProperty) => void;
  isLoadingGroupProperties: boolean;
  groupProperties: IGroupPropertyTyped[];
  refreshGroupProperties: () => Promise<void>;
}

export const GroupPropertyTable = ({
  mappingId,
  groupId,
  onClickAddGroupProperty,
  onClickModifyGroupProperty,
  isLoadingGroupProperties,
  groupProperties,
  refreshGroupProperties,
}: GroupPropertyTableProps) => {
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const [showGroupPropertyDeleteModal, setShowGroupPropertyDeleteModal] =
    useState<boolean>(false);
  const [selectedGroupProperty, setSelectedGroupProperty] = useState<GroupProperty | undefined>(undefined);

  const groupPropertiesColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "propertyName",
            Header: "Property",
            accessor: "propertyName",
            Cell: (value: CellProps<GroupProperty>) => (
              onClickModifyGroupProperty ?
                <div
                  className='iui-anchor'
                  onClick={() => onClickModifyGroupProperty(value.row.original)}
                >
                  {value.row.original.propertyName}
                </div> :
                value.row.original.propertyName
            ),
          },
          {
            id: "dropdown",
            Header: "",
            width: 80,
            Cell: (value: CellProps<GroupProperty>) => {
              return (
                <DropdownMenu
                  menuItems={(close: () => void) => [onClickModifyGroupProperty ? [
                    <MenuItem
                      key={0}
                      onClick={() => onClickModifyGroupProperty(value.row.original)}
                      icon={<SvgEdit />}
                    >
                      Modify
                    </MenuItem>] : [],
                  <MenuItem
                    key={1}
                    onClick={() => {
                      setSelectedGroupProperty(value.row.original);
                      setShowGroupPropertyDeleteModal(true);
                      close();
                    }}
                    icon={<SvgDelete />}
                  >
                    Remove
                  </MenuItem>,
                  ].flatMap((p) => p)}
                >
                  <IconButton styleType='borderless'>
                    <SvgMore
                      style={{
                        width: "16px",
                        height: "16px",
                      }}
                    />
                  </IconButton>
                </DropdownMenu>
              );
            },
          },
        ],
      },
    ],
    [onClickModifyGroupProperty, setSelectedGroupProperty],
  );

  return (
    <>
      <div className="gmw-properties-table-toolbar">
        {onClickAddGroupProperty &&
          <Button
            startIcon={<SvgAdd />}
            styleType='high-visibility'
            onClick={onClickAddGroupProperty}
          >
            Add Property
          </Button>
        }
        <IconButton
          title="Refresh"
          onClick={refreshGroupProperties}
          disabled={isLoadingGroupProperties}
          styleType='borderless'
        >
          <SvgRefresh />
        </IconButton>
      </div>
      <Table
        data={groupProperties}
        density='extra-condensed'
        columns={groupPropertiesColumns}
        emptyTableContent='No Group Properties'
        isSortable
        isLoading={isLoadingGroupProperties}
      />
      <DeleteModal
        entityName={selectedGroupProperty?.propertyName ?? ""}
        show={showGroupPropertyDeleteModal}
        setShow={setShowGroupPropertyDeleteModal}
        onDelete={async () => {
          const accessToken = await getAccessToken();
          await mappingClient.deleteGroupProperty(
            accessToken,
            iModelId,
            mappingId,
            groupId,
            selectedGroupProperty?.id ?? "",
          );
        }}
        refresh={refreshGroupProperties}
      />
    </>
  );
};
