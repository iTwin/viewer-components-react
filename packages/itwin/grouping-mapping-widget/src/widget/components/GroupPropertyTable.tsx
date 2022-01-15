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
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { GroupPropertyReportingAPI } from "../../api/generated/api";
import { reportingClientApi } from "../../api/reportingClient";
import { CreateTypeFromInterface } from "../utils";
import { CellProps } from "react-table";
import DeleteModal from "./DeleteModal";
import { PropertyMenuView } from "./PropertyMenu";

export type GroupProperty = CreateTypeFromInterface<GroupPropertyReportingAPI>;

const fetchGroupProperties = async (
  setGroupProperties: React.Dispatch<React.SetStateAction<GroupProperty[]>>,
  iModelId: string,
  mappingId: string,
  groupId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
) => {
  try {
    setIsLoading(true);
    const groupProperties = await reportingClientApi.getGroupProperties(
      iModelId,
      mappingId,
      groupId,
    );
    setGroupProperties(groupProperties.properties ?? []);
  } catch {
    // TODO Toaster
  } finally {
    setIsLoading(false);
  }
};

const useFetchGroupProperties = (
  iModelId: string,
  mappingId: string,
  groupId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
): [GroupProperty[], React.Dispatch<React.SetStateAction<GroupProperty[]>>] => {
  const [groupProperties, setGroupProperties] = useState<GroupProperty[]>([]);

  useEffect(() => {
    void fetchGroupProperties(
      setGroupProperties,
      iModelId,
      mappingId,
      groupId,
      setIsLoading,
    );
  }, [groupId, iModelId, mappingId, setIsLoading]);

  return [groupProperties, setGroupProperties];
};

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
  selectedGroupProperty?: GroupProperty;
}

const GroupPropertyTable = ({
  iModelId,
  mappingId,
  groupId,
  selectedGroupProperty,
  onGroupPropertyModify,
  setSelectedGroupProperty,
  setGroupModifyView,
}: GroupPropertyTableProps) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [groupProperties, setGroupProperties] = useFetchGroupProperties(
    iModelId,
    mappingId,
    groupId,
    setIsLoading,
  );
  const [showGroupPropertyDeleteModal, setShowGroupPropertyDeleteModal] =
    useState<boolean>(false);

  const refresh = useCallback(async () => {
    setGroupProperties([]);
    await fetchGroupProperties(
      setGroupProperties,
      iModelId,
      mappingId,
      groupId,
      setIsLoading,
    );
  }, [groupId, iModelId, mappingId, setGroupProperties]);

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
                role="button"
                className="iui-anchor"
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
        isLoading={isLoading}
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
        refresh={refresh}
      />
    </>
  );
};

export default GroupPropertyTable;
