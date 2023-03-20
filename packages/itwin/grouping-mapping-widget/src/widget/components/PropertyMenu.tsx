/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Presentation } from "@itwin/presentation-frontend";
import { useActiveIModelConnection } from "@itwin/appui-react";
import React, { useEffect, useMemo, useState } from "react";

import {
  clearEmphasizedOverriddenElements,
  visualizeElements,
  zoomToElements,
} from "./viewerUtils";
import "./PropertyMenu.scss";
import { GroupPropertyTable } from "./GroupPropertyTable";
import {
  IconButton,
  InformationPanelWrapper,
  toaster,
  ToggleSwitch,
} from "@itwin/itwinui-react";
import { useCombinedFetchRefresh } from "../hooks/useFetchData";
import { useMappingClient } from "./context/MappingClientContext";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import type { CalculatedProperty, CustomCalculation, Group, GroupProperty, Mapping } from "@itwin/insights-client";
import { getHiliteIdsAndKeysetFromGroup } from "./groupsHelpers";
import { useGroupHilitedElementsContext } from "./context/GroupHilitedElementsContext";
import { usePropertiesContext } from "./context/PropertiesContext";
import { CalculatedPropertyTable } from "./CalculatedPropertyTable";
import { CustomCalculationTable } from "./CustomCalculationTable";
import { SvgProperties } from "@itwin/itwinui-icons-react";
import { GroupInformationPanel } from "./GroupInformationPanel";

export interface PropertyMenuProps {
  mapping: Mapping;
  group: Group;
  color: string;
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
  color,
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
  const { hilitedElementsQueryCache } = useGroupHilitedElementsContext();
  const mappingClient = useMappingClient();
  const iModelConnection = useActiveIModelConnection();
  const {
    showGroupColor,
    setShowGroupColor,
    groupProperties,
    setGroupProperties,
    calculatedProperties,
    setCalculatedProperties,
    customCalculationProperties,
    setCustomCalculationProperties,
  } = usePropertiesContext();
  const [isInformationPanelOpen, setIsInformationPanelOpen] =
    useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

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

  useEffect(() => {
    const initialize = async () => {
      if (!iModelConnection) return;
      try {
        setIsLoading(true);
        clearEmphasizedOverriddenElements();
        if (showGroupColor) {
          const result = await getHiliteIdsAndKeysetFromGroup(iModelConnection, group, hilitedElementsQueryCache);
          Presentation.selection.clearSelection(
            "GroupingMappingWidget",
            iModelConnection,
          );
          visualizeElements(result.ids, color);
          await zoomToElements(result.ids);
        }
      } catch (error) {
        toaster.negative("There was an error visualizing group.");
        /* eslint-disable no-console */
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    void initialize();
  }, [iModelConnection, group.query, group.groupName, group, hilitedElementsQueryCache, showGroupColor, color]);

  return (
    <InformationPanelWrapper className='gmw-property-menu-wrapper'>
      <div className='gmw-property-menu-container'>
        <div className="gmw-property-menu-toolbar">
          <ToggleSwitch
            label='Color Group'
            labelPosition='left'
            disabled={isLoading}
            checked={showGroupColor}
            onChange={() => setShowGroupColor((b) => !b)}
          ></ToggleSwitch>
          <IconButton
            styleType='borderless'
            onClick={() => setIsInformationPanelOpen(true)}
          >
            <SvgProperties />
          </IconButton>
        </div>
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
      <GroupInformationPanel
        isOpen={isInformationPanelOpen}
        onClose={() => setIsInformationPanelOpen(false)}
        query={group.query}
        groupName={group.groupName}
      />
    </InformationPanelWrapper>
  );
};
