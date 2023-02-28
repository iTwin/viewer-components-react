/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { SvgDelete, SvgEdit, SvgMore } from "@itwin/itwinui-icons-react";
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
import type { CalculatedProperty } from "@itwin/insights-client";
import { useMappingClient } from "./context/MappingClientContext";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import "./CalculatedPropertyTable.scss";
import { PropertyTableToolbar } from "./PropertyTableToolbar";
import { PropertyNameCell } from "./PropertyNameCell";

type ICalculatedPropertyTyped = CreateTypeFromInterface<CalculatedProperty>;

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
  const [showDeleteModal, setShowDeleteModal] = useState<CalculatedProperty | undefined>(undefined);

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
              <PropertyNameCell
                property={value.row.original}
                onClickModify={onClickModifyCalculatedProperty}
              />
            ),
          },
          {
            id: "dropdown",
            Header: "",
            width: 80,
            Cell: (value: CellProps<CalculatedProperty>) => {
              return (
                <DropdownMenu
                  menuItems={(close: () => void) =>
                    [
                      onClickModifyCalculatedProperty
                        ? [
                          <MenuItem
                            key={0}
                            onClick={() =>
                              onClickModifyCalculatedProperty(
                                value.row.original
                              )
                            }
                            icon={<SvgEdit />}
                          >
                            Modify
                          </MenuItem>,
                        ]
                        : [],
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
                    ].flatMap((p) => p)
                  }
                >
                  <IconButton styleType="borderless">
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
    [onClickModifyCalculatedProperty]
  );

  return (
    <>
      <PropertyTableToolbar
        propertyType="Calculated"
        onClickAddProperty={onClickAddCalculatedProperty}
        refreshProperties={refreshCalculatedProperties}
        isLoading={isLoadingCalculatedProperties}
      />
      <Table<ICalculatedPropertyTyped>
        data={calculatedProperties}
        density="extra-condensed"
        columns={calculatedPropertiesColumns}
        emptyTableContent="No Calculated Properties"
        isSortable
        isLoading={isLoadingCalculatedProperties}
      />
      <DeleteModal
        entityName={showDeleteModal?.propertyName}
        onClose={() => setShowDeleteModal(undefined)}
        onDelete={async () => {
          const accessToken = await getAccessToken();
          await mappingClient.deleteCalculatedProperty(
            accessToken,
            iModelId,
            mappingId,
            groupId,
            showDeleteModal?.id ?? ""
          );
        }}
        refresh={refreshCalculatedProperties}
      />
    </>
  );
};
