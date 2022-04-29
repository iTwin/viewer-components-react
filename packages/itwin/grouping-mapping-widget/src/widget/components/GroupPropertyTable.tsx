/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  SvgAdd,
  SvgDelete,
  SvgEdit,
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
import type { GroupPropertyReportingAPI } from "../../api/generated/api";
import { reportingClientApi } from "../../api/reportingClient";
import type { CreateTypeFromInterface } from "../utils";
import type { CellProps } from "react-table";
import DeleteModal from "./DeleteModal";
import { PropertyMenuView } from "./PropertyMenu";

export type GroupProperty = CreateTypeFromInterface<GroupPropertyReportingAPI>;

interface GroupPropertyTableProps {
  iModelId: string;
  mappingId: string;
  groupId: string;
  setSelectedGroupProperty: React.Dispatch<
  React.SetStateAction<
  CreateTypeFromInterface<GroupPropertyReportingAPI> | undefined
  >
  >;
  setGroupModifyView: React.Dispatch<React.SetStateAction<PropertyMenuView>>;
  onGroupPropertyModify: (value: CellProps<GroupProperty>) => void;
  isLoadingGroupProperties: boolean;
  groupProperties: GroupProperty[];
  refreshGroupProperties: () => Promise<void>;
  selectedGroupProperty?: GroupProperty;
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
            Cell: (value: CellProps<GroupProperty>) => (
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
            Cell: (value: CellProps<GroupProperty>) => {
              return (
                <DropdownMenu
                  menuItems={(close: () => void) => [
                    <MenuItem
                      key={0}
                      onClick={() => onGroupPropertyModify(value)}
                      icon={<SvgEdit />}
                    >
                      Modify
                    </MenuItem>,
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
      <Table<GroupProperty>
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
          await reportingClientApi.deleteGroupProperty(
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
