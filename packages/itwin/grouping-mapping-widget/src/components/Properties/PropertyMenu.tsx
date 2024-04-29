/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useCallback } from "react";
import "./PropertyMenu.scss";
import { GroupPropertyTable } from "./GroupProperties/GroupPropertyTable";
import { useGroupingMappingApiConfig } from "../context/GroupingApiConfigContext";
import type { Group, GroupMinimal, Mapping, Property } from "@itwin/insights-client";
import { CalculatedPropertyTable } from "./CalculatedProperties/CalculatedPropertyTable";
import { CustomCalculationTable } from "./CustomCalculations/CustomCalculationTable";
import { useGroupPropertiesQuery } from "./hooks/useGroupPropertiesQuery";
import { useCalculatedPropertiesQuery } from "./hooks/useCalculatedPropertiesQuery";
import { useCustomCalculationsQuery } from "./hooks/useCustomCalculationsQuery";
import { useQueryClient } from "@tanstack/react-query";
import { usePropertiesClient } from "../context/PropertiesClientContext";

export interface PropertyMenuProps {
  mapping: Mapping;
  group: Group | GroupMinimal;
  onClickAddGroupProperty?: () => void;
  onClickModifyGroupProperty?: (groupProperty: Property) => void;
  onClickAddCalculatedProperty?: () => void;
  onClickModifyCalculatedProperty?: (calculatedProperty: Property) => void;
  onClickAddCustomCalculationProperty?: () => void;
  onClickModifyCustomCalculation?: (customCalculation: Property) => void;
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
  const propertiesClient = usePropertiesClient();
  const queryClient = useQueryClient();

  const { data: groupProperties, isFetching: isLoadingGroupProperties } = useGroupPropertiesQuery(iModelId, mappingId, groupId, getAccessToken, propertiesClient);
  const { data: calculatedProperties, isFetching: isLoadingCalculatedProperties } = useCalculatedPropertiesQuery(iModelId, mappingId, groupId, getAccessToken, propertiesClient);
  const { data: customCalculationProperties, isFetching: isLoadingCustomCalculations } = useCustomCalculationsQuery(iModelId, mappingId, groupId, getAccessToken, propertiesClient);

  const refreshGroupProperties = useCallback(async () => queryClient.invalidateQueries({ queryKey: ["groupProperties", iModelId, mappingId, group.id] }), [group.id, iModelId, mappingId, queryClient]);
  const refreshCalculatedProperties = useCallback(async () => queryClient.invalidateQueries({ queryKey: ["calculatedProperties", iModelId, mappingId, group.id] }), [group.id, iModelId, mappingId, queryClient]);
  const refreshCustomCalculations = useCallback(async () => queryClient.invalidateQueries({ queryKey: ["customCalculations", iModelId, mappingId, group.id] }), [group.id, iModelId, mappingId, queryClient]);

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
          groupProperties={groupProperties ? groupProperties.properties : []}
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
          calculatedProperties={calculatedProperties ? calculatedProperties.properties : []}
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
          customCalculations={customCalculationProperties ? customCalculationProperties.properties : []}
          refresh={refreshCustomCalculations}
        />
      )}
    </div>
  );
};
