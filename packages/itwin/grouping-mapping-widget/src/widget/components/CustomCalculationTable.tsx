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

export interface CustomCalculationTableProps {
  mappingId: string;
  groupId: string;
  onClickAdd?: () => void;
  onClickModify?: (value: CustomCalculation) => void;
  isLoading: boolean;
  customCalculations: CustomCalculation[];
  refresh: () => Promise<void>;
}

export const CustomCalculationTable = ({
  mappingId,
  groupId,
  onClickAdd,
  onClickModify,
  isLoading,
  customCalculations,
  refresh,
}: CustomCalculationTableProps) => {
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const [showDeleteModal, setShowDeleteModal] = useState<CustomCalculation | undefined>(undefined);

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
                property={value.row.original}
                onClickModify={onClickModify}
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
      <PropertyTableToolbar
        propertyType="Custom Calculation"
        onClickAddProperty={onClickAdd}
        refreshProperties={refresh}
        isLoading={isLoading}
      />
      <Table<ICustomCalculationTyped>
        data={customCalculations}
        density='extra-condensed'
        columns={CustomCalculationsColumns}
        emptyTableContent='No Custom Calculations'
        isSortable
        isLoading={isLoading}
      />
      <DeleteModal
        entityName={showDeleteModal?.propertyName}
        onClose={() => setShowDeleteModal(undefined)}
        onDelete={async () => {
          const accessToken = await getAccessToken();
          await mappingClient.deleteCustomCalculation(
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

