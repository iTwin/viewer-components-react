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
import type { CellProps, Column } from "react-table";
import type { CalculatedProperty } from "@itwin/insights-client";
import { useMappingClient } from "../../context/MappingClientContext";
import "./CalculatedPropertyTable.scss";
import { PropertyNameCell } from "../PropertyNameCell";
import { PropertyTable } from "../PropertyTable";
import { useGroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const queryClient = useQueryClient();

  const columnsFactory = useCallback(
    (handleShowDeleteModal: (value: CalculatedProperty) => void): Column<CalculatedProperty>[] => [
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
                        onClick={() => {
                          onClickModify(
                            value.row.original
                          );
                          close();
                        }
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
    [onClickModify]
  );

  const { mutateAsync: deleteProperty } = useMutation({
    mutationFn: async (propertyId: string) => {
      const accessToken = await getAccessToken();
      await mappingClient.deleteCalculatedProperty(
        accessToken,
        iModelId,
        mappingId,
        groupId,
        propertyId,
      );
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["calculatedProperties"] }),
  });

  return (
    <PropertyTable
      propertyType="Calculated"
      columnsFactory={columnsFactory}
      data={calculatedProperties}
      isLoading={isLoading}
      onClickAdd={onClickAdd}
      refreshProperties={refresh}
      deleteProperty={deleteProperty}
    />
  );
};
