/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  SvgAdd,
  SvgDelete,
  SvgMore,
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
import { PropertyMenuView } from "./PropertyMenu";
import type { GroupProperty } from "@itwin/insights-client";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import { useMappingClient } from "./context/MappingClientContext";

export type IGroupPropertyTyped = CreateTypeFromInterface<GroupProperty>;

interface GroupPropertyTableProps {
  iModelId: string;
  mappingId: string;
  groupId: string;
  setSelectedGroupProperty: React.Dispatch<React.SetStateAction<IGroupPropertyTyped | undefined>>;
  setGroupModifyView: React.Dispatch<React.SetStateAction<PropertyMenuView>>;
  onGroupPropertyModify: (value: CellProps<IGroupPropertyTyped>) => void;
  isLoadingGroupProperties: boolean;
  groupProperties: IGroupPropertyTyped[];
  refreshGroupProperties: () => Promise<void>;
  selectedGroupProperty?: IGroupPropertyTyped;
}

const GroupPropertyTable = ({
  iModelId,
  mappingId,
  groupId,
  selectedGroupProperty,
  onGroupPropertyModify,
  setSelectedGroupProperty,
  isLoadingGroupProperties,
  groupProperties,
  refreshGroupProperties,
  setGroupModifyView,
}: GroupPropertyTableProps) => {
  const { getAccessToken } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const [showGroupPropertyDeleteModal, setShowGroupPropertyDeleteModal] =
    useState<boolean>(false);

  const groupPropertiesColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "propertyName",
            Header: "Property",
            accessor: "propertyName",
            Cell: (value: CellProps<IGroupPropertyTyped>) => (
              <div
                className='iui-anchor'
                onClick={() => onGroupPropertyModify(value)}
              >
                {value.row.original.propertyName}
              </div>
            ),
          },
          {
            id: "dropdown",
            Header: "",
            width: 80,
            Cell: (value: CellProps<IGroupPropertyTyped>) => {
              return (
                <DropdownMenu
                  menuItems={(close: () => void) => [
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
                  ]}
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
    [onGroupPropertyModify, setSelectedGroupProperty],
  );

  return (
    <>
      <Button
        startIcon={<SvgAdd />}
        styleType='high-visibility'
        onClick={() => {
          setGroupModifyView(PropertyMenuView.ADD_GROUP_PROPERTY);
        }}
      >
        Add Property
      </Button>
      <Table<IGroupPropertyTyped>
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

export default GroupPropertyTable;
