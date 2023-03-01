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

export interface CalculatedPropertyTableProps {
  mappingId: string;
  groupId: string;
  onClickAdd?: () => void;
  onClickModify?: (value: CalculatedProperty) => void;
  isLoading: boolean;
  calculatedProperties: CalculatedProperty[];
  refreshCalculatedProperties: () => Promise<void>;
}

export const CalculatedPropertyTable = ({
  mappingId,
  groupId,
  onClickAdd,
  onClickModify,
  isLoading,
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
    [onClickModify]
  );

  return (
    <>
      <PropertyTableToolbar
        propertyType="Calculated"
        onClickAddProperty={onClickAdd}
        refreshProperties={refreshCalculatedProperties}
        isLoading={isLoading}
      />
      <Table<ICalculatedPropertyTyped>
        data={calculatedProperties}
        density="extra-condensed"
        columns={calculatedPropertiesColumns}
        emptyTableContent="No Calculated Properties"
        isSortable
        isLoading={isLoading}
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
