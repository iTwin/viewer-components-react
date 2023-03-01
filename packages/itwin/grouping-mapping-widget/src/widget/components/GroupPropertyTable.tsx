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

export interface GroupPropertyTableProps {
  iModelId: string;
  mappingId: string;
  groupId: string;
  onClickAdd?: () => void;
  onClickModify?: (value: GroupProperty) => void;
  isLoading: boolean;
  groupProperties: GroupProperty[];
  refresh: () => Promise<void>;
}

export const GroupPropertyTable = ({
  mappingId,
  groupId,
  onClickAdd,
  onClickModify,
  isLoading,
  groupProperties,
  refresh,
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
                onClickModify={onClickModify}
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
                  menuItems={(close: () => void) => [onClickModify ? [
                    <MenuItem
                      key={0}
                      onClick={() => onClickModify(value.row.original)}
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
    [onClickModify],
  );

  return (
    <>
      <div className="gmw-properties-table-toolbar">
        <PropertyTableToolbar
          propertyType="Group"
          onClickAddProperty={onClickAdd}
          refreshProperties={refresh}
          isLoading={isLoading}
        />
      </div>
      <Table<IGroupPropertyTyped>
        data={isLoading ? [] : groupProperties}
        density='extra-condensed'
        columns={groupPropertiesColumns}
        emptyTableContent='No Group Properties'
        isSortable
        isLoading={isLoading}
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
        refresh={refresh}
      />
    </>
  );
};
