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
import type { CreateTypeFromInterface } from "../utils";
import { PropertyMenuView } from "./PropertyMenu";
import type { CellProps } from "react-table";
import DeleteModal from "./DeleteModal";
import type { CalculatedProperty } from "@itwin/insights-client";
import { useMappingClient } from "./context/MappingClientContext";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";

export type ICalculatedPropertyTyped =
  CreateTypeFromInterface<CalculatedProperty>;

interface CalculatedPropertyTableProps {
  iModelId: string;
  mappingId: string;
  groupId: string;
  setSelectedCalculatedProperty: React.Dispatch<React.SetStateAction<ICalculatedPropertyTyped | undefined>>;
  setGroupModifyView: React.Dispatch<React.SetStateAction<PropertyMenuView>>;
  onCalculatedPropertyModify: (value: CellProps<ICalculatedPropertyTyped>) => void;
  isLoadingCalculatedProperties: boolean;
  calculatedProperties: ICalculatedPropertyTyped[];
  refreshCalculatedProperties: () => Promise<void>;
  selectedCalculatedProperty?: ICalculatedPropertyTyped;
}

const CalculatedPropertyTable = ({
  iModelId,
  mappingId,
  groupId,
  setSelectedCalculatedProperty,
  setGroupModifyView,
  onCalculatedPropertyModify,
  isLoadingCalculatedProperties: isLoadingGroupProperties,
  calculatedProperties,
  refreshCalculatedProperties,
  selectedCalculatedProperty,
}: CalculatedPropertyTableProps) => {
  const { getAccessToken } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const [
    showCalculatedPropertyDeleteModal,
    setShowCalculatedPropertyDeleteModal,
  ] = useState<boolean>(false);

  const calculatedPropertiesColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "propertyName",
            Header: "Calculated Property",
            accessor: "propertyName",
            Cell: (value: CellProps<ICalculatedPropertyTyped>) => (
              <div
                className='iui-anchor'
                onClick={() => onCalculatedPropertyModify(value)}
              >
                {value.row.original.propertyName}
              </div>
            ),
          },
          {
            id: "dropdown",
            Header: "",
            width: 80,
            Cell: (value: CellProps<ICalculatedPropertyTyped>) => {
              return (
                <DropdownMenu
                  menuItems={(close: () => void) => [
                    <MenuItem
                      key={0}
                      onClick={() => onCalculatedPropertyModify(value)}
                      icon={<SvgEdit />}
                    >
                      Modify
                    </MenuItem>,
                    <MenuItem
                      key={1}
                      onClick={() => {
                        setSelectedCalculatedProperty(value.row.original);
                        setShowCalculatedPropertyDeleteModal(true);
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
    [onCalculatedPropertyModify, setSelectedCalculatedProperty],
  );

  return (
    <>
      <Button
        startIcon={<SvgAdd />}
        styleType='high-visibility'
        onClick={() => {
          setGroupModifyView(PropertyMenuView.ADD_CALCULATED_PROPERTY);
        }}
      >
        Add Calculated Property
      </Button>
      <Table<ICalculatedPropertyTyped>
        data={calculatedProperties}
        density='extra-condensed'
        columns={calculatedPropertiesColumns}
        emptyTableContent='No Calculated Properties'
        isSortable
        isLoading={isLoadingGroupProperties}
      />

      <DeleteModal
        entityName={selectedCalculatedProperty?.propertyName ?? ""}
        show={showCalculatedPropertyDeleteModal}
        setShow={setShowCalculatedPropertyDeleteModal}
        onDelete={async () => {
          const accessToken = await getAccessToken();
          await mappingClient.deleteCalculatedProperty(
            accessToken,
            iModelId,
            mappingId,
            groupId,
            selectedCalculatedProperty?.id ?? "",
          );
        }}
        refresh={refreshCalculatedProperties}
      />
    </>
  );
};

export default CalculatedPropertyTable;
