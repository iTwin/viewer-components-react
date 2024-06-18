/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Fieldset, Text } from "@itwin/itwinui-react";
import React, { useState } from "react";
import ActionPanel from "../../SharedComponents/ActionPanel";
import useValidator from "../hooks/useValidator";
import "./CalculatedPropertyAction.scss";
import type { CalculatedPropertyType, Group, Property } from "@itwin/insights-client";
import { DataType } from "@itwin/insights-client";
import { SharedCalculatedPropertyForms } from "./SharedCalculatedPropertyForms";
import { useGroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePropertiesClient } from "../../context/PropertiesClientContext";

/**
 * @deprecated in 0.27.0 The CalculatedPropertyActionProps has been superseded by the CalculatedPropertyActionWithVisualsProps and should not be used, use GroupPropertyActionProps and GroupPropertyAction component instead.
 * Props for the {@link CalculatedPropertyAction} component.
 * @public
 */
export interface CalculatedPropertyActionProps {
  mappingId: string;
  group: Group;
  calculatedProperty?: Property;
  onSaveSuccess: () => void;
  onClickCancel?: () => void;
}

/**
 * @deprecated in 0.27.0 The CalculatedPropertyAction has been superseded by the CalculatedPropertyActionWithVisuals and should not be used as a stand alone component, use GroupPropertyAction component instead.
 * Component to create or update a calculated property.
 * @public
 */
export const CalculatedPropertyAction = ({ mappingId, group, calculatedProperty, onSaveSuccess, onClickCancel }: CalculatedPropertyActionProps) => {
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const propertiesClient = usePropertiesClient();
  const [propertyName, setPropertyName] = useState<string>(calculatedProperty?.propertyName ?? "");
  const [type, setType] = useState<CalculatedPropertyType | undefined>(calculatedProperty?.calculatedPropertyType ?? undefined);
  const [validator, showValidationMessage] = useValidator();
  const queryClient = useQueryClient();

  const { mutate: saveMutation, isLoading } = useMutation(
    async (type: CalculatedPropertyType) => {
      const accessToken = await getAccessToken();

      return calculatedProperty
        ? propertiesClient.updateProperty(accessToken, mappingId, group.id, calculatedProperty.id, {
            ...calculatedProperty,
            propertyName,
            dataType: calculatedProperty.dataType,
            calculatedPropertyType: type,
          })
        : propertiesClient.createProperty(accessToken, mappingId, group.id, {
            propertyName,
            dataType: DataType.Double,
            calculatedPropertyType: type,
          });
    },
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ["properties", iModelId, mappingId, group.id] });
        onSaveSuccess();
        setPropertyName("");
        setType(undefined);
      },
    },
  );

  const onSave = () => {
    if (!validator.allValid() || !type) {
      showValidationMessage(true);
      return;
    }

    saveMutation(type);
  };

  return (
    <>
      <div className="gmw-calculated-properties-action-container">
        <Fieldset legend="Calculated Property Details" className="gmw-details-form">
          <div className="gmw-field-legend-container">
            <Text variant="small" as="small" className="gmw-field-legend">
              Asterisk * indicates mandatory fields.
            </Text>
          </div>
          <SharedCalculatedPropertyForms calculatedPropertyType={type} setCalculatedPropertyType={setType} />
        </Fieldset>
      </div>
      <ActionPanel onSave={onSave} onCancel={onClickCancel} isSavingDisabled={!(type && propertyName)} isLoading={isLoading} />
    </>
  );
};
