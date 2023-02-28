/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  SvgDelete,
  SvgEdit,
  SvgMore,
} from "@itwin/itwinui-icons-react";
import {
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
import { PropertyTableToolbar } from "./PropertyTableToolbar";
import { PropertyNameCell } from "./PropertyNameCell";

type IGroupPropertyTyped = CreateTypeFromInterface<GroupProperty>;

interface GroupPropertyTableProps {
  iModelId: string;
  mappingId: string;
  groupId: string;
  onClickAddGroupProperty?: () => void;
  onClickModifyGroupProperty?: (value: GroupProperty) => void;
  isLoadingGroupProperties: boolean;
  groupProperties: GroupProperty[];
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
  const [showDeleteModal, setShowDeleteModal] = useState<GroupProperty | undefined>(undefined);

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
              <PropertyNameCell
                property={value.row.original}
                onClickModify={onClickModifyGroupProperty}
              />
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
                      setShowDeleteModal(value.row.original);
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
    [onClickModifyGroupProperty],
  );

  return (
    <>
      <div className="gmw-properties-table-toolbar">
        <PropertyTableToolbar
          propertyType="Group"
          onClickAddProperty={onClickAddGroupProperty}
          refreshProperties={refreshGroupProperties}
          isLoading={isLoadingGroupProperties}
        />
      </div>
      <Table<IGroupPropertyTyped>
        data={groupProperties}
        density='extra-condensed'
        columns={groupPropertiesColumns}
        emptyTableContent='No Group Properties'
        isSortable
        isLoading={isLoadingGroupProperties}
      />
      <DeleteModal
        entityName={showDeleteModal?.propertyName}
        onClose={() => setShowDeleteModal(undefined)}
        onDelete={async () => {
          const accessToken = await getAccessToken();
          await mappingClient.deleteGroupProperty(
            accessToken,
            iModelId,
            mappingId,
            groupId,
            showDeleteModal?.id ?? "",
          );
        }}
        refresh={refreshGroupProperties}
      />
    </>
  );
};
