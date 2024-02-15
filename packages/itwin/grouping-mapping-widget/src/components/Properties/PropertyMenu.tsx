/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useCallback } from "react";
import "./PropertyMenu.scss";
import { GroupPropertyTable } from "./GroupProperties/GroupPropertyTable";
import { useMappingClient } from "../context/MappingClientContext";
import { useGroupingMappingApiConfig } from "../context/GroupingApiConfigContext";
import type { CalculatedProperty, CustomCalculation, Group, GroupProperty, Mapping } from "@itwin/insights-client";
import { CalculatedPropertyTable } from "./CalculatedProperties/CalculatedPropertyTable";
import { CustomCalculationTable } from "./CustomCalculations/CustomCalculationTable";
import { useGroupPropertiesQuery } from "./hooks/useGroupPropertiesQuery";
import { useCalculatedPropertiesQuery } from "./hooks/useCalculatedPropertiesQuery";
import { useCustomCalculationsQuery } from "./hooks/useCustomCalculationsQuery";
import { useQueryClient } from "@tanstack/react-query";

export interface PropertyMenuProps {
  mapping: Mapping;
  group: Group;
  onClickAddGroupProperty?: () => void;
  onClickModifyGroupProperty?: (groupProperty: GroupProperty) => void;
  onClickAddCalculatedProperty?: () => void;
  onClickModifyCalculatedProperty?: (calculatedProperty: CalculatedProperty) => void;
  onClickAddCustomCalculationProperty?: () => void;
  onClickModifyCustomCalculation?: (customCalculation: CustomCalculation) => void;
  hideGroupProps?: boolean;
  hideCalculatedProps?: boolean;
  hideCustomCalculationProps?: boolean;
}

export const PropertyMenu = ({
  mapping,
  group,
  onClickAddGroupProperty,
  onClickModifyGroupProperty,
  onClickAddCalculatedProperty,
  onClickModifyCalculatedProperty,
  onClickAddCustomCalculationProperty,
  onClickModifyCustomCalculation,
  hideGroupProps = false,
  hideCalculatedProps = false,
  hideCustomCalculationProps = false,
}: PropertyMenuProps) => {
  const groupId = group.id;
  const mappingId = mapping.id;
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const queryClient = useQueryClient();

  const { data: groupProperties, isFetching: isLoadingGroupProperties } = useGroupPropertiesQuery(iModelId, mappingId, groupId, getAccessToken, mappingClient);
  const { data: calculatedProperties, isFetching: isLoadingCalculatedProperties } = useCalculatedPropertiesQuery(iModelId, mappingId, groupId, getAccessToken, mappingClient);
  const { data: customCalculationProperties, isFetching: isLoadingCustomCalculations } = useCustomCalculationsQuery(iModelId, mappingId, groupId, getAccessToken, mappingClient);

  const refreshGroupProperties = useCallback(async () => queryClient.invalidateQueries({ queryKey: ["groupProperties"] }), [queryClient]);
  const refreshCalculatedProperties = useCallback(async () => queryClient.invalidateQueries({ queryKey: ["calculatedProperties"] }), [queryClient]);
  const refreshCustomCalculations = useCallback(async () => queryClient.invalidateQueries({ queryKey: ["customCalculations"] }), [queryClient]);

  return (
    <div className='gmw-property-menu-wrapper'>
      {!hideGroupProps && (
        <GroupPropertyTable
          iModelId={iModelId}
          mappingId={mappingId}
          groupId={groupId}
          onClickAdd={onClickAddGroupProperty}
          onClickModify={onClickModifyGroupProperty}
          isLoading={isLoadingGroupProperties}
          groupProperties={groupProperties ?? []}
          refresh={refreshGroupProperties}
        />
      )}
      {!hideCalculatedProps && (
        <CalculatedPropertyTable
          mappingId={mappingId}
          groupId={groupId}
          onClickAdd={onClickAddCalculatedProperty}
          onClickModify={onClickModifyCalculatedProperty}
          isLoading={isLoadingCalculatedProperties}
          calculatedProperties={calculatedProperties ?? []}
          refresh={refreshCalculatedProperties}
        />
      )}
      {!hideCustomCalculationProps && (
        <CustomCalculationTable
          mappingId={mappingId}
          groupId={groupId}
          onClickAdd={onClickAddCustomCalculationProperty}
          onClickModify={onClickModifyCustomCalculation}
          isLoading={isLoadingCustomCalculations}
          customCalculations={customCalculationProperties ?? []}
          refresh={refreshCustomCalculations}
        />
      )}
    </div>
  );
};
