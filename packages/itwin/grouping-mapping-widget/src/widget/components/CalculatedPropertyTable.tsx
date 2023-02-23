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
import type { CalculatedProperty } from "@itwin/insights-client";
import { useMappingClient } from "./context/MappingClientContext";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import "./CalculatedPropertyTable.scss";

type ICalculatedPropertyTyped =
  CreateTypeFromInterface<CalculatedProperty>;

interface CalculatedPropertyTableProps {
  mappingId: string;
  groupId: string;
  onClickAddCalculatedProperty?: () => void;
  onClickModifyCalculatedProperty?: (value: CalculatedProperty) => void;
  isLoadingCalculatedProperties: boolean;
  calculatedProperties: CalculatedProperty[];
  refreshCalculatedProperties: () => Promise<void>;
}

export const CalculatedPropertyTable = ({
  mappingId,
  groupId,
  onClickAddCalculatedProperty,
  onClickModifyCalculatedProperty,
  isLoadingCalculatedProperties,
  calculatedProperties,
  refreshCalculatedProperties,
}: CalculatedPropertyTableProps) => {
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const [
    showCalculatedPropertyDeleteModal,
    setShowCalculatedPropertyDeleteModal,
  ] = useState<boolean>(false);
  const [selectedCalculatedProperty, setSelectedCalculatedProperty] = useState<CalculatedProperty | undefined>(undefined);

  const calculatedPropertiesColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "propertyName",
            Header: "Calculated Property",
            accessor: "propertyName",
            Cell: (value: CellProps<CalculatedProperty>) => (
              onClickModifyCalculatedProperty ?
                <div
                  className='iui-anchor'
                  onClick={() => onClickModifyCalculatedProperty(value.row.original)}
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
            Cell: (value: CellProps<CalculatedProperty>) => {
              return (
                <DropdownMenu
                  menuItems={(close: () => void) => [
                    onClickModifyCalculatedProperty ? [
                      <MenuItem
                        key={0}
                        onClick={() => onClickModifyCalculatedProperty(value.row.original)}
                        icon={<SvgEdit />}
                      >
                        Modify
                      </MenuItem>] : [],
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
    [onClickModifyCalculatedProperty],
  );

  return (
    <>
      <div className="gmw-calculated-table-toolbar">
        {onClickAddCalculatedProperty &&
          <Button
            startIcon={<SvgAdd />}
            styleType='high-visibility'
            onClick={onClickAddCalculatedProperty}
          >
            Add Calculated Property
          </Button>
        }
        <IconButton
          title="Refresh"
          onClick={refreshCalculatedProperties}
          disabled={isLoadingCalculatedProperties}
          styleType='borderless'
        >
          <SvgRefresh />
        </IconButton>
      </div>
      <Table<ICalculatedPropertyTyped>
        data={calculatedProperties}
        density='extra-condensed'
        columns={calculatedPropertiesColumns}
        emptyTableContent='No Calculated Properties'
        isSortable
        isLoading={isLoadingCalculatedProperties}
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

