/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React, { useCallback, useState } from "react";
import "./PropertyMenu.scss";
import { ValidationPropertyTable } from "./ValidationPropertyTable";
import type { GroupMinimal, Mapping, Property } from "@itwin/insights-client";
import { usePropertiesQuery } from "../hooks/usePropertiesQuery";
import { useQueryClient } from "@tanstack/react-query";
import { useGroupingMappingApiConfig, usePropertiesClient } from "@itwin/grouping-mapping-widget";
import { FunctionType } from "../PropertiesValidation/PropertiesValidationAction";

/**
 * Props for the {@link PropertyMenu} component.
 * @public
 */
export interface PropertyMenuProps {
  mapping: Mapping;
  group: GroupMinimal;
  onClickAddRuleProperty?: () => void;
  onClickModifyRuleProperty?: (rule: ValidationRule) => void;
  ruleList: ValidationRule[];
  setRuleList: (value: ValidationRule[]) => void;
  hideGroupProps?: boolean;
}

export interface ValidationRule {
  name: string;
  description: string;
  onProperty: Property;
  property: Property;
  function: FunctionType;
  min?: number;
  max?: number;
}

/**
 * Component to display validation properties.
 * @public
 */
export const PropertyMenu = ({
  mapping,
  group,
  onClickAddRuleProperty,
  onClickModifyRuleProperty,
  ruleList,
  setRuleList,
  hideGroupProps = false,
}: PropertyMenuProps) => {
  const groupId = group.id;
  const mappingId = mapping.id;
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const propertiesClient = usePropertiesClient();
  const queryClient = useQueryClient();

  const { data: groupProperties, isFetching: isLoadingGroupProperties } = usePropertiesQuery(iModelId, mappingId, groupId, getAccessToken, propertiesClient);

  const refreshGroupProperties = useCallback(
    async () => queryClient.invalidateQueries({ queryKey: ["properties", iModelId, mappingId, group.id] }),
    [group.id, iModelId, mappingId, queryClient],
  );

  return (
    <div className="gmw-property-menu-wrapper">
      {!hideGroupProps && (
        <ValidationPropertyTable
          iModelId={iModelId}
          mapping={mapping}
          group={group}
          onClickAdd={onClickAddRuleProperty}
          onClickModify={onClickModifyRuleProperty}
          isLoading={isLoadingGroupProperties}
          groupProperties={groupProperties ? groupProperties.properties : []}
          refresh={refreshGroupProperties}
          ruleList={ruleList}
          setRuleList={setRuleList}
        />
      )}
    </div>
  );
};
