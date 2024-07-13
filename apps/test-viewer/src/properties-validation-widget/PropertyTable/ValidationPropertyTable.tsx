/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { SvgDelete, SvgEdit, SvgMore } from "@itwin/itwinui-icons-react";
import { DropdownMenu, IconButton, MenuItem, Text } from "@itwin/itwinui-react";
import React, { useCallback } from "react";
import type { CellProps, Column } from "react-table";
import type { GroupMinimal, Mapping, Property } from "@itwin/insights-client";
import { PropertyNameCell } from "./PropertyNameCell";
import { PropertyTable } from "./PropertyTable";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useGroupingMappingApiConfig, usePropertiesClient } from "@itwin/grouping-mapping-widget";
import { ValidationRule } from "./PropertyMenu";

export interface ValidationPropertyTableProps {
  iModelId: string;
  mapping: Mapping;
  group: GroupMinimal;
  onClickAdd?: () => void;
  onClickModify?: (value: ValidationRule) => void;
  isLoading: boolean;
  groupProperties: Property[];
  refresh: () => Promise<void>;
  ruleList: ValidationRule[];
  setRuleList: (value: ValidationRule[]) => void;
}

export const ValidationPropertyTable = ({
  mapping,
  group,
  onClickAdd,
  onClickModify,
  isLoading,
  groupProperties,
  refresh,
  ruleList,
  setRuleList,
}: ValidationPropertyTableProps) => {
  const propertiesClient = usePropertiesClient();
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const queryClient = useQueryClient();

  const columnsFactory = useCallback(
    (handleShowDeleteModal: (value: ValidationRule) => void): Column<ValidationRule>[] => [
      {
        id: "ruleName",
        Cell: (value: CellProps<ValidationRule>) => <PropertyNameCell rule={value.row.original} onClickModify={onClickModify} />,
      },
      {
        id: "rulePropertyName",
        Cell: (value: CellProps<ValidationRule>) => <Text>{value.row.original.onProperty.propertyName}</Text>,
      },
      {
        id: "ruleFunction",
        Cell: (value: CellProps<ValidationRule>) => <Text>{value.row.original.function}</Text>,
      },
      {
        id: "ruleMin",
        Cell: (value: CellProps<ValidationRule>) => <Text>{value.row.original.min ? `>= ${value.row.original.min}` : ""}</Text>,
      },
      {
        id: "ruleMax",
        Cell: (value: CellProps<ValidationRule>) => <Text>{value.row.original.max ? `>= ${value.row.original.max}` : ""}</Text>,
      },
      {
        id: "dropdown",
        width: 80,
        Cell: (value: CellProps<ValidationRule>) => {
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
              <IconButton styleType="borderless" title="Property Options">
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
      await propertiesClient.deleteProperty(accessToken, mapping.id, group.id, propertyId);
      return propertyId;
    },
    onSuccess: async (propertyId) => {
      const updatedRuleList = ruleList.filter((rule) => rule.property.id !== propertyId);
      setRuleList(updatedRuleList);
      await queryClient.invalidateQueries({ queryKey: ["properties", iModelId, mapping.id, group.id] });
    },
  });

  return (
    <PropertyTable
      columnsFactory={columnsFactory}
      group={group}
      groupData={groupProperties}
      mapping={mapping}
      isLoading={isLoading}
      onClickAdd={onClickAdd}
      refreshProperties={refresh}
      deleteProperty={deleteProperty}
      ruleList={ruleList}
    />
  );
};
