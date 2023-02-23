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
  InformationPanel,
  InformationPanelBody,
  InformationPanelHeader,
  InformationPanelWrapper,
  LabeledTextarea,
  ProgressRadial,
  Text,
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
  const { hilitedElementsQueryCache } = useGroupHilitedElementsContext();
  const [showGroupColor, setShowGroupColor] = useState<boolean>(false);
  const mappingClient = useMappingClient();
  const iModelConnection = useActiveIModelConnection();
  const {
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
      return async () => mappingClient.getGroupProperties((await getAccessToken()), iModelId, mappingId, groupId);
    },
    [getAccessToken, mappingClient, iModelId, mappingId, groupId],
  );
  const { isLoading: isLoadingGroupProperties, refreshData: refreshGroupProperties } =
    useCombinedFetchRefresh<GroupProperty>(fetchGroupProperties, setGroupProperties);

  const fetchCalculatedProperties = useMemo(
    () => {
      return async () => mappingClient.getCalculatedProperties((await getAccessToken()), iModelId, mappingId, groupId);
    },
    [getAccessToken, mappingClient, iModelId, mappingId, groupId],
  );
  const { isLoading: isLoadingCalculatedProperties, refreshData: refreshCalculatedProperties } =
    useCombinedFetchRefresh<CalculatedProperty>(fetchCalculatedProperties, setCalculatedProperties);

  const fetchCustomCalculations = useMemo(
    () => {
      return async () => mappingClient.getCustomCalculations((await getAccessToken()), iModelId, mappingId, groupId);
    },
    [getAccessToken, mappingClient, iModelId, mappingId, groupId],
  );
  const { isLoading: isLoadingCustomCalculations, refreshData: refreshCustomCalculations } =
    useCombinedFetchRefresh<CustomCalculation>(fetchCustomCalculations, setCustomCalculationProperties);

  useEffect(() => {
    const initialize = async () => {
      if (!iModelConnection) return;
      setIsLoading(true);
      clearEmphasizedOverriddenElements();
      if (showGroupColor) {
        const result = await getHiliteIdsAndKeysetFromGroup(iModelConnection, group, hilitedElementsQueryCache);
        Presentation.selection.clearSelection(
          "GroupingMappingWidget",
          iModelConnection,
        );
        visualizeElements(result.ids, "red");
        await zoomToElements(result.ids);
      }
      setIsLoading(false);
    };
    void initialize();
  }, [iModelConnection, group.query, group.groupName, group, hilitedElementsQueryCache, showGroupColor]);

  if (isLoading) {
    return (
      <div className='gmw-loading-overlay'>
        <Text>Loading Group</Text>
        <ProgressRadial indeterminate />
        <Text>Please wait...</Text>
      </div>
    );
  }

  return (
    <InformationPanelWrapper className='gmw-property-menu-wrapper'>
      <div className='gmw-property-menu-container'>
        <div className="gmw-property-menu-toolbar">
          <ToggleSwitch
            label='Color Group'
            labelPosition='right'
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
          <div className='gmw-property-table'>
            <GroupPropertyTable
              iModelId={iModelId}
              mappingId={mappingId}
              groupId={groupId}
              onClickAddGroupProperty={onClickAddGroupProperty}
              onClickModifyGroupProperty={onClickModifyGroupProperty}
              isLoadingGroupProperties={isLoadingGroupProperties}
              groupProperties={groupProperties ?? []}
              refreshGroupProperties={refreshGroupProperties}
            />
          </div>
        )}
        {!hideCalculatedProps && (
          <div className='gmw-property-table'>
            <CalculatedPropertyTable
              mappingId={mappingId}
              groupId={groupId}
              onClickAddCalculatedProperty={onClickAddCalculatedProperty}
              onClickModifyCalculatedProperty={onClickModifyCalculatedProperty}
              isLoadingCalculatedProperties={isLoadingCalculatedProperties}
              calculatedProperties={calculatedProperties ?? []}
              refreshCalculatedProperties={refreshCalculatedProperties}
            />
          </div>
        )}
        {!hideCustomCalculationProps && (
          <div className='gmw-property-table'>
            <CustomCalculationTable
              mappingId={mappingId}
              groupId={groupId}
              onClickAddCustomCalculationProperty={onClickAddCustomCalculationProperty}
              onClickModifyCustomCalculation={onClickModifyCustomCalculation}
              isLoadingCustomCalculations={isLoadingCustomCalculations}
              customCalculations={customCalculationProperties ?? []}
              refreshCustomCalculations={refreshCustomCalculations}
            />
          </div>
        )}
      </div>
      <InformationPanel
        className='gmw-information-panel'
        isOpen={isInformationPanelOpen}
      >
        <InformationPanelHeader
          onClose={() => setIsInformationPanelOpen(false)}
        >
          <Text variant='subheading'>{`${group.groupName} Information`}</Text>
        </InformationPanelHeader>
        <InformationPanelBody>
          <div className='gmw-information-body'>
            <LabeledTextarea
              label='Query'
              rows={15}
              readOnly
              defaultValue={group.query}
            />
          </div>
        </InformationPanelBody>
      </InformationPanel>
    </InformationPanelWrapper>
  );
};
