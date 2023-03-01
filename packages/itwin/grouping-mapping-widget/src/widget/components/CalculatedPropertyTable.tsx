/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { SvgDelete, SvgEdit, SvgMore } from "@itwin/itwinui-icons-react";
import {
  DropdownMenu,
  IconButton,
  MenuItem,
} from "@itwin/itwinui-react";
import React, { useCallback } from "react";
import type { CellProps } from "react-table";
import type { CalculatedProperty } from "@itwin/insights-client";
import { useMappingClient } from "./context/MappingClientContext";
import "./CalculatedPropertyTable.scss";
import { PropertyNameCell } from "./PropertyNameCell";
import { PropertyTable } from "./PropertyTable";

export interface CalculatedPropertyTableProps {
  mappingId: string;
  groupId: string;
  onClickAdd?: () => void;
  onClickModify?: (value: CalculatedProperty) => void;
  isLoading: boolean;
  calculatedProperties: CalculatedProperty[];
  refresh: () => Promise<void>;
}

export const CalculatedPropertyTable = ({
  mappingId,
  groupId,
  onClickAdd,
  onClickModify,
  isLoading,
  calculatedProperties,
  refresh,
}: CalculatedPropertyTableProps) => {
  const mappingClient = useMappingClient();

  const columns = useCallback(
    (handleShowDeleteModal: (value: CalculatedProperty) => void) => [
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
                onClickModify={onClickModify}
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
                      onClickModify
                        ? [
                          <MenuItem
                            key={0}
                            onClick={() =>
                              onClickModify(
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
                          handleShowDeleteModal(value.row.original);
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
    [onClickModify]
  );

  const deleteProperty = useCallback(async (iModelId: string, accessToken: string, propertyId: string) => {
    await mappingClient.deleteCalculatedProperty(
      accessToken,
      iModelId,
      mappingId,
      groupId,
      propertyId,
    );
  }, [groupId, mappingClient, mappingId]);

  return (
    <PropertyTable
      propertyType="Calculated"
      columns={columns}
      data={calculatedProperties}
      isLoading={isLoading}
      onClickAdd={onClickAdd}
      refreshProperties={refresh}
      deleteProperty={deleteProperty}
    />
  );
};
