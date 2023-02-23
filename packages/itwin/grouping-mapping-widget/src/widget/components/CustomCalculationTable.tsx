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
import type { CustomCalculation } from "@itwin/insights-client";
import { useMappingClient } from "./context/MappingClientContext";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import "./CustomCalculationTable.scss";

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
              onClickModifyCustomCalculation ?
                <div
                  className='iui-anchor'
                  onClick={() => onClickModifyCustomCalculation(value.row.original)}
                >
                  {value.row.original.propertyName}
                </div> :
                value.row.original.propertyName
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
      <div className="gmw-custom-calc-table-toolbar">
        {onClickAddCustomCalculationProperty &&
          <Button
            startIcon={<SvgAdd />}
            styleType='high-visibility'
            onClick={onClickAddCustomCalculationProperty}
          >
            Add Calculated Property
          </Button>
        }
        <IconButton
          title="Refresh"
          onClick={refreshCustomCalculations}
          disabled={isLoadingCustomCalculations}
          styleType='borderless'
        >
          <SvgRefresh />
        </IconButton>
      </div>
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

