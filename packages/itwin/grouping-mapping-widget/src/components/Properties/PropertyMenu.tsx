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
import { usePropertiesQuery } from "./hooks/usePropertiesQuery";
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

  const { data: groupProperties, isFetching: isLoadingGroupProperties } = usePropertiesQuery(iModelId, mappingId, groupId, getAccessToken, propertiesClient);

  const refreshGroupProperties = useCallback(async () => queryClient.invalidateQueries({ queryKey: ["properties", iModelId, mappingId, group.id] }), [group.id, iModelId, mappingId, queryClient]);

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
          isLoading={isLoadingGroupProperties}
          calculatedProperties={groupProperties ? groupProperties.properties : []}
          refresh={refreshGroupProperties}
        />
      )}
      {!hideCustomCalculationProps && (
        <CustomCalculationTable
          mappingId={mappingId}
          groupId={groupId}
          onClickAdd={onClickAddCustomCalculationProperty}
          onClickModify={onClickModifyCustomCalculation}
          isLoading={isLoadingGroupProperties}
          customCalculations={groupProperties ? groupProperties.properties : []}
          refresh={refreshGroupProperties}
        />
      )}
    </div>
  );
};
