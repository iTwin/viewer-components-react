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
import React, { useContext, useMemo, useState } from "react";
import type { CreateTypeFromInterface } from "../utils";
import { PropertyMenuView } from "./PropertyMenu";
import type { CellProps } from "react-table";
import DeleteModal from "./DeleteModal";
import type { CustomCalculation } from "@itwin/insights-client";
import { ApiContext, MappingClientContext } from "./GroupingMapping";

export type CustomCalculationType =
  CreateTypeFromInterface<CustomCalculation>;

interface CustomCalculationTableProps {
  iModelId: string;
  mappingId: string;
  groupId: string;
  setSelectedCustomCalculation: React.Dispatch<React.SetStateAction<CreateTypeFromInterface<CustomCalculationType> | undefined>>;
  setGroupModifyView: React.Dispatch<React.SetStateAction<PropertyMenuView>>;
  onCustomCalculationModify: (value: CellProps<CustomCalculationType>) => void;
  isLoadingCustomCalculations: boolean;
  customCalculations: CustomCalculationType[];
  refreshCustomCalculations: () => Promise<void>;
  selectedCustomCalculation?: CustomCalculationType;
}

const CustomCalculationTable = ({
  iModelId,
  mappingId,
  groupId,
  setSelectedCustomCalculation,
  setGroupModifyView,
  onCustomCalculationModify,
  isLoadingCustomCalculations,
  customCalculations,
  refreshCustomCalculations,
  selectedCustomCalculation,
}: CustomCalculationTableProps) => {
  const apiContext = useContext(ApiContext);
  const mappingClient = useContext(MappingClientContext);
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
            Cell: (value: CellProps<CustomCalculationType>) => (
              <div
                className='iui-anchor'
                onClick={() => onCustomCalculationModify(value)}
              >
                {value.row.original.propertyName}
              </div>
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
            Cell: (value: CellProps<CustomCalculationType>) => {
              return (
                <DropdownMenu
                  menuItems={(close: () => void) => [
                    <MenuItem
                      key={0}
                      onClick={() => onCustomCalculationModify(value)}
                      icon={<SvgEdit />}
                    >
                      Modify
                    </MenuItem>,
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
    [onCustomCalculationModify, setSelectedCustomCalculation],
  );

  return (
    <>
      <Button
        startIcon={<SvgAdd />}
        styleType='high-visibility'
        onClick={() => {
          setGroupModifyView(PropertyMenuView.ADD_CUSTOM_CALCULATION);
        }}
      >
        Add Custom Calculation
      </Button>
      <Table<CustomCalculationType>
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
          await mappingClient.deleteCustomCalculation(
            apiContext.accessToken,
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

export default CustomCalculationTable;
