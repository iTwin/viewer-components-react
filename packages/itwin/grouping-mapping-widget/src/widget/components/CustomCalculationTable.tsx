/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  SvgDelete,
  SvgEdit,
  SvgMore,
  SvgStatusWarning,
} from "@itwin/itwinui-icons-react";
import {
  DefaultCell,
  DropdownMenu,
  IconButton,
  MenuItem,
} from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { CellProps, CellRendererProps } from "react-table";
import type { CalculatedProperty, CalculatedPropertyLinks, CustomCalculation, DataType, GroupProperty, QuantityType } from "@itwin/insights-client";
import { useMappingClient } from "./context/MappingClientContext";
import { PropertyTable } from "./PropertyTable";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import { usePropertiesContext } from "./context/PropertiesContext";
import { handleError } from "./utils";
import { getOutliers } from "./PropertyValidationUtils";

interface TableData extends CustomCalculation {
  id: string;
  propertyName: string;
  formula: string;
  dataType: DataType;
  quantityType: QuantityType;
  _links: CalculatedPropertyLinks;
  startIcon?: JSX.Element;
  customCalc?: CustomCalculation;
}

export interface CustomCalculationTableProps {
  mappingId: string;
  groupId: string;
  onClickAdd?: () => void;
  onClickModify?: (value: TableData) => void;
  isLoading: boolean;
  customCalculations: CustomCalculation[];
  refresh: () => Promise<void>;
}

let groupProps: GroupProperty[];
let calcProps: CalculatedProperty[];
let customCalcProps: CustomCalculation[];
let allProps: string[] = [];

export const CustomCalculationTable = ({
  mappingId,
  groupId,
  onClickAdd,
  onClickModify,
  isLoading,
  customCalculations,
  refresh,
}: CustomCalculationTableProps) => {
  const mappingClient = useMappingClient();
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();

  const {
    setGroupProperties,
    setCalculatedProperties,
    setCustomCalculationProperties,
  } = usePropertiesContext();
  const [tableData, setTableData] = useState<TableData[]>(customCalculations);
  const [outliers, setOutliers] = useState<string[]>([]);

  const getValues = useCallback(async () => {
    allProps = [];
    const accessToken = await getAccessToken();
    const [groupProps, calcProps, customCalcProps] = await Promise.all([
      mappingClient.getGroupProperties(accessToken, iModelId, mappingId, groupId),
      mappingClient.getCalculatedProperties(accessToken, iModelId, mappingId, groupId),
      mappingClient.getCustomCalculations(accessToken, iModelId, mappingId, groupId),
    ]);
    setGroupProperties(groupProps);
    setCalculatedProperties(calcProps);
    setCustomCalculationProperties(customCalcProps);
    setTableData(customCalcProps);

    const localOutliers = await getOutliers({ groupProps, calcProps, customCalcProps, allProps });

    if (localOutliers.length > 0) {
      setOutliers(localOutliers);
    }
  }, [getAccessToken, groupId, iModelId, mappingClient, mappingId, setCalculatedProperties, setCustomCalculationProperties, setGroupProperties]);

  useMemo(() => {
    const updateTableData = tableData;
    for (const prop of tableData) {
      const propName = prop.propertyName;
      const localOutliers = outliers;
      prop.customCalc = {
        id: prop.id,
        propertyName: prop.propertyName,
        formula: prop.formula,
        dataType: prop.dataType,
        quantityType: prop.quantityType,
        _links: prop._links,
      };
      if (localOutliers.includes(propName)) {
        prop.startIcon = <IconButton
          styleType="borderless"
          title="Warning: Some variable/s from the formula aren't defined"
          onClick={() => getValues}>
          <SvgStatusWarning style={{ fill: "#a05c08", width: "16px", height: "16px" }}>
          </SvgStatusWarning>
        </IconButton>;
      }
    }
    setTableData(updateTableData);
  }, [getValues, outliers, tableData]);

  const fetchAllProperties = useCallback(async () => {
    try {
      if (!groupProps || !calcProps || !customCalcProps) {
        await getValues();
      }
    } catch (error: any) {
      handleError(error.status);
    } finally {
    }
  }, [getValues]);

  useEffect(() => {
    void fetchAllProperties();
  }, [fetchAllProperties]);

  const columnsFactory = useCallback(
    (handleShowDeleteModal: (value: CustomCalculation) => void) => [
      {
        Header: "Table",
        columns: [
          {
            id: "propertyName",
            Header: "Custom Calculation",
            accessor: "propertyName",
            cellRenderer: (props: CellRendererProps<{ startIcon: JSX.Element, customCalc: CustomCalculation }>) =>
              onClickModify ? (
                <DefaultCell {...props} endIcon={props.cellProps.row.original.startIcon} className="iui-anchor" onClick={() => onClickModify(props.cellProps.row.original.customCalc)} />
              ) : (
                <DefaultCell {...props} endIcon={props.cellProps.row.original.startIcon} className="iui-anchor" />
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
                      onClick={() => {
                        onClickModify(value.row.original);
                        close();
                      }}
                      icon={<SvgEdit />}
                    >
                      Modify
                    </MenuItem>] : [],
                  <MenuItem
                    key={1}
                    onClick={() => {
                      handleShowDeleteModal(value.row.original);
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

  const deleteProperty = useCallback(async (propertyId: string) => {
    const accessToken = await getAccessToken();
    await mappingClient.deleteCustomCalculation(
      accessToken,
      iModelId,
      mappingId,
      groupId,
      propertyId,
    );
  }, [getAccessToken, groupId, iModelId, mappingClient, mappingId]);

  return (
    <div>
      <PropertyTable
        propertyType="Custom Calculation"
        columnsFactory={columnsFactory}
        data={tableData}
        isLoading={isLoading}
        onClickAdd={onClickAdd}
        refreshProperties={refresh}
        deleteProperty={deleteProperty}
      />
    </div>
  );
};

