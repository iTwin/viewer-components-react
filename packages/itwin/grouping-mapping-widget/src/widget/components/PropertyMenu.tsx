/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useMemo } from "react";
import "./PropertyMenu.scss";
import { GroupPropertyTable } from "./GroupPropertyTable";
import { useCombinedFetchRefresh } from "../hooks/useFetchData";
import { useMappingClient } from "./context/MappingClientContext";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import type { CalculatedProperty, CustomCalculation, Group, GroupProperty, Mapping } from "@itwin/insights-client";
import { usePropertiesContext } from "./context/PropertiesContext";
import { CalculatedPropertyTable } from "./CalculatedPropertyTable";
import { CustomCalculationTable } from "./CustomCalculationTable";

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
  const {
    groupProperties,
    setGroupProperties,
    calculatedProperties,
    setCalculatedProperties,
    customCalculationProperties,
    setCustomCalculationProperties,
  } = usePropertiesContext();

  const fetchGroupProperties = useMemo(
    () => {
      return async () => mappingClient.getGroupProperties(await getAccessToken(), iModelId, mappingId, groupId);
    },
    [getAccessToken, mappingClient, iModelId, mappingId, groupId],
  );
  const { isLoading: isLoadingGroupProperties, refreshData: refreshGroupProperties } =
    useCombinedFetchRefresh<GroupProperty>(fetchGroupProperties, setGroupProperties);

  const fetchCalculatedProperties = useMemo(
    () => {
      return async () => mappingClient.getCalculatedProperties(await getAccessToken(), iModelId, mappingId, groupId);
    },
    [getAccessToken, mappingClient, iModelId, mappingId, groupId],
  );
  const { isLoading: isLoadingCalculatedProperties, refreshData: refreshCalculatedProperties } =
    useCombinedFetchRefresh<CalculatedProperty>(fetchCalculatedProperties, setCalculatedProperties);

  const fetchCustomCalculations = useMemo(
    () => {
      return async () => mappingClient.getCustomCalculations(await getAccessToken(), iModelId, mappingId, groupId);
    },
    [getAccessToken, mappingClient, iModelId, mappingId, groupId],
  );
  const { isLoading: isLoadingCustomCalculations, refreshData: refreshCustomCalculations } =
    useCombinedFetchRefresh<CustomCalculation>(fetchCustomCalculations, setCustomCalculationProperties);

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
