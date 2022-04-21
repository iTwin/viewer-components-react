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
import type { CalculatedProperty } from "@itwin/insights-client";
import { ReportingClient } from "@itwin/insights-client";
import type { Api } from "./GroupingMapping";
import { ApiContext } from "./GroupingMapping";

export type CalculatedPropertyType =
  CreateTypeFromInterface<CalculatedProperty>;

const fetchCalculatedProperties = async (
  setCalculatedProperties: React.Dispatch<
  React.SetStateAction<CalculatedPropertyType[]>
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
    const calculatedProperties =
      await reportingClientApi.getCalculatedProperties(
        apiContext.accessToken,
        iModelId,
        mappingId,
        groupId,
      );
    setCalculatedProperties(calculatedProperties.properties ?? []);
  } catch (error: any) {
    handleError(error.status);
  } finally {
    setIsLoading(false);
  }
};

interface CalculatedPropertyTableProps {
  iModelId: string;
  mappingId: string;
  groupId: string;

  setSelectedCalculatedProperty: React.Dispatch<
  React.SetStateAction<
  CreateTypeFromInterface<CalculatedProperty> | undefined
  >
  >;
  setGroupModifyView: React.Dispatch<React.SetStateAction<PropertyMenuView>>;
  onCalculatedPropertyModify: (value: CellProps<CalculatedPropertyType>) => void;
  selectedCalculatedProperty?: CalculatedPropertyType;
}

const CalculatedPropertyTable = ({
  iModelId,
  mappingId,
  groupId,
  setSelectedCalculatedProperty,
  setGroupModifyView,
  onCalculatedPropertyModify,
  selectedCalculatedProperty,
}: CalculatedPropertyTableProps) => {
  const apiContext = useContext(ApiContext);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [
    showCalculatedPropertyDeleteModal,
    setShowCalculatedPropertyDeleteModal,
  ] = useState<boolean>(false);
  const [calculatedProperties, setCalculatedProperties] = useState<
  CalculatedPropertyType[]
  >([]);

  useEffect(() => {
    void fetchCalculatedProperties(
      setCalculatedProperties,
      iModelId,
      mappingId,
      groupId,
      setIsLoading,
      apiContext
    );
  }, [apiContext, groupId, iModelId, mappingId, setIsLoading]);

  const refresh = useCallback(async () => {
    setCalculatedProperties([]);
    await fetchCalculatedProperties(
      setCalculatedProperties,
      iModelId,
      mappingId,
      groupId,
      setIsLoading,
      apiContext
    );
  }, [apiContext, groupId, iModelId, mappingId, setCalculatedProperties]);

  const calculatedPropertiesColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "propertyName",
            Header: "Calculated Property",
            accessor: "propertyName",
            Cell: (value: CellProps<CalculatedPropertyType>) => (
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
            Cell: (value: CellProps<CalculatedPropertyType>) => {
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
      <Table<CalculatedPropertyType>
        data={calculatedProperties}
        density='extra-condensed'
        columns={calculatedPropertiesColumns}
        emptyTableContent='No Calculated Properties'
        isSortable
        isLoading={isLoading}
      />

      <DeleteModal
        entityName={selectedCalculatedProperty?.propertyName ?? ""}
        show={showCalculatedPropertyDeleteModal}
        setShow={setShowCalculatedPropertyDeleteModal}
        onDelete={async () => {
          const reportingClientApi = new ReportingClient(apiContext.prefix);
          await reportingClientApi.deleteCalculatedProperty(
            apiContext.accessToken,
            iModelId,
            mappingId,
            groupId,
            selectedCalculatedProperty?.id ?? "",
          );
        }}
        refresh={refresh}
      />
    </>
  );
};

export default CalculatedPropertyTable;
