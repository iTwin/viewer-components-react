/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { SvgDelete, SvgEdit, SvgMore } from "@itwin/itwinui-icons-react";
import { DropdownMenu, IconButton, MenuItem } from "@itwin/itwinui-react";
import React, { useCallback } from "react";
import type { CellProps, Column } from "react-table";
import type { Property } from "@itwin/insights-client";
import "./CalculatedPropertyTable.scss";
import { PropertyNameCell } from "../PropertyNameCell";
import { PropertyTable } from "../PropertyTable";
import { useGroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePropertiesClient } from "../../context/PropertiesClientContext";

export interface CalculatedPropertyTableProps {
  mappingId: string;
  groupId: string;
  onClickAdd?: () => void;
  onClickModify?: (value: Property) => void;
  isLoading: boolean;
  calculatedProperties: Property[];
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
  const propertiesClient = usePropertiesClient();
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const queryClient = useQueryClient();

  const columnsFactory = useCallback(
    (handleShowDeleteModal: (value: Property) => void): Column<Property>[] => [
      {
        id: "propertyName",
        Header: "Calculated Property",
        accessor: "propertyName",
        Cell: (value: CellProps<Property>) => <PropertyNameCell property={value.row.original} onClickModify={onClickModify} />,
      },
      {
        id: "dropdown",
        Header: "",
        width: 80,
        Cell: (value: CellProps<Property>) => {
          return (
            <DropdownMenu
              menuItems={(close: () => void) =>
                [
                  onClickModify
                    ? [
                        <MenuItem
                          key={0}
                          onClick={() => {
                            onClickModify(value.row.original);
                            close();
                          }}
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
                <SvgMore />
              </IconButton>
            </DropdownMenu>
          );
        },
      },
    ],
    [onClickModify],
  );

  const { mutateAsync: deleteProperty } = useMutation({
    mutationFn: async (propertyId: string) => {
      const accessToken = await getAccessToken();
      await propertiesClient.deleteProperty(accessToken, mappingId, groupId, propertyId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["properties", iModelId, mappingId, groupId] });
    },
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
