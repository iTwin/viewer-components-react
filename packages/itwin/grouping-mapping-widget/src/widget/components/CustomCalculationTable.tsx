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
import type { CustomCalculation } from "@itwin/insights-client";
import { useMappingClient } from "./context/MappingClientContext";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import { PropertyTableToolbar } from "./PropertyTableToolbar";
import { PropertyNameCell } from "./PropertyNameCell";

type ICustomCalculationTyped =
  CreateTypeFromInterface<CustomCalculation>;

interface CustomCalculationTableProps {
  mappingId: string;
  groupId: string;
  onClickAddCustomCalculationProperty?: () => void;
  onClickModifyCustomCalculation?: (value: CustomCalculation) => void;
  isLoadingCustomCalculations: boolean;
  customCalculations: CustomCalculation[];
  refreshCustomCalculations: () => Promise<void>;
}

export const CustomCalculationTable = ({
  mappingId,
  groupId,
  onClickAddCustomCalculationProperty,
  onClickModifyCustomCalculation,
  isLoadingCustomCalculations,
  customCalculations,
  refreshCustomCalculations,
}: CustomCalculationTableProps) => {
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const [selectedCustomCalculation, setSelectedCustomCalculation] = useState<CustomCalculation | undefined>(undefined);
  const [
    showCustomCalculationDeleteModal,
    setShowCustomCalculationDeleteModal,
  ] = useState<boolean>(false);

  const CustomCalculationsColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "propertyName",
            Header: "Custom Calculation",
            accessor: "propertyName",
            Cell: (value: CellProps<CustomCalculation>) => (
              <PropertyNameCell
                propertyName={value.row.original.propertyName}
                property={value.row.original}
                onClickModify={onClickModifyCustomCalculation}
              />
            ),
          },
          {
            id: "formula",
            Header: "Formula",
            accessor: "formula",
          },
          {
            id: "dropdown",
            Header: "",
            width: 80,
            Cell: (value: CellProps<CustomCalculation>) => {
              return (
                <DropdownMenu
                  menuItems={(close: () => void) => [onClickModifyCustomCalculation ? [
                    <MenuItem
                      key={0}
                      onClick={() => onClickModifyCustomCalculation(value.row.original)}
                      icon={<SvgEdit />}
                    >
                      Modify
                    </MenuItem>] : [],
                  <MenuItem
                    key={1}
                    onClick={() => {
                      setSelectedCustomCalculation(value.row.original);
                      setShowCustomCalculationDeleteModal(true);
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
    [onClickModifyCustomCalculation],
  );

  return (
    <>
      <PropertyTableToolbar
        propertyType="Custom Calculation"
        onClickAddProperty={onClickAddCustomCalculationProperty}
        refreshProperties={refreshCustomCalculations}
        isLoadingProperties={isLoadingCustomCalculations}
      />
      <Table<ICustomCalculationTyped>
        data={customCalculations}
        density='extra-condensed'
        columns={CustomCalculationsColumns}
        emptyTableContent='No Custom Calculations'
        isSortable
        isLoading={isLoadingCustomCalculations}
      />
      <DeleteModal
        entityName={selectedCustomCalculation?.propertyName ?? ""}
        show={showCustomCalculationDeleteModal}
        setShow={setShowCustomCalculationDeleteModal}
        onDelete={async () => {
          const accessToken = await getAccessToken();
          await mappingClient.deleteCustomCalculation(
            accessToken,
            iModelId,
            mappingId,
            groupId,
            selectedCustomCalculation?.id ?? "",
          );
        }}
        refresh={refreshCustomCalculations}
      />
    </>
  );
};

