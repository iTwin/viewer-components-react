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
import { CustomCalculationReportingAPI } from "../../api/generated/api";
import { reportingClientApi } from "../../api/reportingClient";
import { CreateTypeFromInterface } from "../utils";
import { PropertyMenuView } from "./PropertyMenu";
import { CellProps } from "react-table";
import DeleteModal from "./DeleteModal";

export type CustomCalculation =
  CreateTypeFromInterface<CustomCalculationReportingAPI>;

const fetchCustomCalculations = async (
  setCustomCalculations: React.Dispatch<
  React.SetStateAction<CustomCalculation[]>
  >,
  iModelId: string,
  mappingId: string,
  groupId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
) => {
  try {
    setIsLoading(true);
    const customCalculations = await reportingClientApi.getCustomCalculations(
      iModelId,
      mappingId,
      groupId,
    );
    setCustomCalculations(customCalculations.customCalculations ?? []);
  } catch {
    // TODO Toaster
  } finally {
    setIsLoading(false);
  }
};

const useFetchCustomCalculations = (
  iModelId: string,
  mappingId: string,
  groupId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
): [
  CustomCalculation[],
  React.Dispatch<React.SetStateAction<CustomCalculation[]>>,
] => {
  const [CustomCalculations, setCustomCalculations] = useState<
  CustomCalculation[]
  >([]);

  useEffect(() => {
    void fetchCustomCalculations(
      setCustomCalculations,
      iModelId,
      mappingId,
      groupId,
      setIsLoading,
    );
  }, [groupId, iModelId, mappingId, setIsLoading]);

  return [CustomCalculations, setCustomCalculations];
};

interface CustomCalculationTableProps {
  iModelId: string;
  mappingId: string;
  groupId: string;

  setSelectedCustomCalculation: React.Dispatch<
  React.SetStateAction<
  CreateTypeFromInterface<CustomCalculationReportingAPI> | undefined
  >
  >;
  setGroupModifyView: React.Dispatch<React.SetStateAction<PropertyMenuView>>;
  onCustomCalculationModify: (value: CellProps<CustomCalculation>) => void;
  selectedCustomCalculation?: CustomCalculation;
}

const CustomCalculationTable = ({
  iModelId,
  mappingId,
  groupId,
  setSelectedCustomCalculation,
  setGroupModifyView,
  onCustomCalculationModify,
  selectedCustomCalculation,
}: CustomCalculationTableProps) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [customCalculations, setCustomCalculations] =
    useFetchCustomCalculations(iModelId, mappingId, groupId, setIsLoading);
  const [
    showCustomCalculationDeleteModal,
    setShowCustomCalculationDeleteModal,
  ] = useState<boolean>(false);

  const refresh = useCallback(async () => {
    setCustomCalculations([]);
    await fetchCustomCalculations(
      setCustomCalculations,
      iModelId,
      mappingId,
      groupId,
      setIsLoading,
    );
  }, [groupId, iModelId, mappingId, setCustomCalculations]);

  const CustomCalculationsColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "propertyName",
            Header: "Calculated Property",
            accessor: "propertyName",
            Cell: (value: CellProps<CustomCalculation>) => (
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
            Cell: (value: CellProps<CustomCalculation>) => {
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
      <Table<CustomCalculation>
        data={customCalculations}
        density='extra-condensed'
        columns={CustomCalculationsColumns}
        emptyTableContent='No Custom Calculations'
        isSortable
        isLoading={isLoading}
      />

      <DeleteModal
        entityName={selectedCustomCalculation?.propertyName ?? ""}
        show={showCustomCalculationDeleteModal}
        setShow={setShowCustomCalculationDeleteModal}
        onDelete={async () => {
          await reportingClientApi.deleteCustomCalculation(
            iModelId,
            mappingId,
            groupId,
            selectedCustomCalculation?.id ?? "",
          );
        }}
        refresh={refresh}
      />
    </>
  );
};

export default CustomCalculationTable;
