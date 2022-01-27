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
import { CalculatedPropertyReportingAPI } from "../../api/generated/api";
import { reportingClientApi } from "../../api/reportingClient";
import { CreateTypeFromInterface } from "../utils";
import { PropertyMenuView } from "./PropertyMenu";
import { CellProps } from "react-table";
import DeleteModal from "./DeleteModal";

export type CalculatedProperty =
  CreateTypeFromInterface<CalculatedPropertyReportingAPI>;

const fetchCalculatedProperties = async (
  setCalculatedProperties: React.Dispatch<
  React.SetStateAction<CalculatedProperty[]>
  >,
  iModelId: string,
  mappingId: string,
  groupId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
) => {
  try {
    setIsLoading(true);
    const calculatedProperties =
      await reportingClientApi.getCalculatedProperties(
        iModelId,
        mappingId,
        groupId,
      );
    setCalculatedProperties(calculatedProperties.properties ?? []);
  } catch {
    // TODO Toaster
  } finally {
    setIsLoading(false);
  }
};

const useFetchCalculatedProperties = (
  iModelId: string,
  mappingId: string,
  groupId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
): [
  CalculatedProperty[],
  React.Dispatch<React.SetStateAction<CalculatedProperty[]>>,
] => {
  const [calculatedProperties, setCalculatedProperties] = useState<
  CalculatedProperty[]
  >([]);

  useEffect(() => {
    void fetchCalculatedProperties(
      setCalculatedProperties,
      iModelId,
      mappingId,
      groupId,
      setIsLoading,
    );
  }, [groupId, iModelId, mappingId, setIsLoading]);

  return [calculatedProperties, setCalculatedProperties];
};

interface CalculatedPropertyTableProps {
  iModelId: string;
  mappingId: string;
  groupId: string;

  setSelectedCalculatedProperty: React.Dispatch<
  React.SetStateAction<
  CreateTypeFromInterface<CalculatedPropertyReportingAPI> | undefined
  >
  >;
  setGroupModifyView: React.Dispatch<React.SetStateAction<PropertyMenuView>>;
  onCalculatedPropertyModify: (value: CellProps<CalculatedProperty>) => void;
  selectedCalculatedProperty?: CalculatedProperty;
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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [calculatedProperties, setCalculatedProperties] =
    useFetchCalculatedProperties(iModelId, mappingId, groupId, setIsLoading);
  const [
    showCalculatedPropertyDeleteModal,
    setShowCalculatedPropertyDeleteModal,
  ] = useState<boolean>(false);

  const refresh = useCallback(async () => {
    setCalculatedProperties([]);
    await fetchCalculatedProperties(
      setCalculatedProperties,
      iModelId,
      mappingId,
      groupId,
      setIsLoading,
    );
  }, [groupId, iModelId, mappingId, setCalculatedProperties]);

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
            Cell: (value: CellProps<CalculatedProperty>) => {
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
      <Table<CalculatedProperty>
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
          await reportingClientApi.deleteCalculatedProperty(
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
