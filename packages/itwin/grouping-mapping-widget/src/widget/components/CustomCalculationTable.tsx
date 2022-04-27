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
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CreateTypeFromInterface } from "../utils";
import { PropertyMenuView } from "./PropertyMenu";
import type { CellProps } from "react-table";
import DeleteModal from "./DeleteModal";
import { handleError } from "./utils";
import type { CustomCalculation } from "@itwin/insights-client";
import { ReportingClient } from "@itwin/insights-client";
import type { Api } from "./GroupingMapping";
import { ApiContext } from "./GroupingMapping";

export type CustomCalculationType =
  CreateTypeFromInterface<CustomCalculation>;

const fetchCustomCalculations = async (
  setCustomCalculations: React.Dispatch<
  React.SetStateAction<CustomCalculationType[]>
  >,
  iModelId: string,
  mappingId: string,
  groupId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  apiContext: Api
) => {
  try {
    setIsLoading(true);
    const reportingClientApi = new ReportingClient(apiContext.prefix);
    const customCalculations = await reportingClientApi.getCustomCalculations(
      apiContext.accessToken,
      iModelId,
      mappingId,
      groupId,
    );
    setCustomCalculations(customCalculations);
  } catch (error: any) {
    handleError(error.status);
  } finally {
    setIsLoading(false);
  }
};

interface CustomCalculationTableProps {
  iModelId: string;
  mappingId: string;
  groupId: string;

  setSelectedCustomCalculation: React.Dispatch<
  React.SetStateAction<
  CreateTypeFromInterface<CustomCalculation> | undefined
  >
  >;
  setGroupModifyView: React.Dispatch<React.SetStateAction<PropertyMenuView>>;
  onCustomCalculationModify: (value: CellProps<CustomCalculationType>) => void;
  selectedCustomCalculation?: CustomCalculationType;
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
  const apiContext = useContext(ApiContext);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [
    showCustomCalculationDeleteModal,
    setShowCustomCalculationDeleteModal,
  ] = useState<boolean>(false);
  const [customCalculations, setCustomCalculations] = useState<
  CustomCalculationType[]
  >([]);

  useEffect(() => {
    void fetchCustomCalculations(
      setCustomCalculations,
      iModelId,
      mappingId,
      groupId,
      setIsLoading,
      apiContext
    );
  }, [apiContext, groupId, iModelId, mappingId, setIsLoading]);

  const refresh = useCallback(async () => {
    setCustomCalculations([]);
    await fetchCustomCalculations(
      setCustomCalculations,
      iModelId,
      mappingId,
      groupId,
      setIsLoading,
      apiContext
    );
  }, [apiContext, groupId, iModelId, mappingId, setCustomCalculations]);

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
        isLoading={isLoading}
      />

      <DeleteModal
        entityName={selectedCustomCalculation?.propertyName ?? ""}
        show={showCustomCalculationDeleteModal}
        setShow={setShowCustomCalculationDeleteModal}
        onDelete={async () => {
          const reportingClientApi = new ReportingClient(apiContext.prefix);
          await reportingClientApi.deleteCustomCalculation(
            apiContext.accessToken,
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
