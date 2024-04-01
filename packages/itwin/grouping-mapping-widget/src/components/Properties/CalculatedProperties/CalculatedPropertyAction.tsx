/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  Fieldset,
  Text,
} from "@itwin/itwinui-react";
import React, { useState } from "react";
import ActionPanel from "../../SharedComponents/ActionPanel";
import useValidator from "../hooks/useValidator";
import "./CalculatedPropertyAction.scss";
import type { Group, Property } from "@itwin/insights-client";
import { CalculatedPropertyType, DataType } from "@itwin/insights-client";
import { SharedCalculatedPropertyForms } from "./SharedCalculatedPropertyForms";
import { useGroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePropertiesClient } from "../../context/PropertiesClientContext";

export interface CalculatedPropertyActionProps {
  mappingId: string;
  group: Group;
  calculatedProperty?: Property;
  onSaveSuccess: () => void;
  onClickCancel?: () => void;
}

export const CalculatedPropertyAction = ({
  mappingId,
  group,
  calculatedProperty,
  onSaveSuccess,
  onClickCancel,
}: CalculatedPropertyActionProps) => {
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const propertiesClient = usePropertiesClient();
  const [propertyName, setPropertyName] = useState<string>(
    calculatedProperty?.propertyName ?? "",
  );
  const [type, setType] = useState<CalculatedPropertyType | undefined>(calculatedProperty?.calculatedPropertyType);
  const [validator, showValidationMessage] = useValidator();
  const queryClient = useQueryClient();

  const { mutate: saveMutation, isLoading } = useMutation(async (type: CalculatedPropertyType) => {
    const accessToken = await getAccessToken();

    return calculatedProperty
      ? propertiesClient.updateProperty(
        accessToken,
        mappingId,
        group.id,
        calculatedProperty.id,
        {
          propertyName,
          dataType: calculatedProperty.dataType,
          calculatedPropertyType: type,
        },
      )
      : propertiesClient.createProperty(
        accessToken,
        mappingId,
        group.id,
        {
          propertyName,
          dataType: DataType.Undefined,
          calculatedPropertyType: type,
        },
      );
  }, {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["calculatedProperties", iModelId, mappingId, group.id] });
      onSaveSuccess();
      setPropertyName("");
      setType(CalculatedPropertyType.Undefined);
    },
  });

  const onSave = () => {
    if (!validator.allValid() || !type) {
      showValidationMessage(true);
      return;
    }

    saveMutation(type);
  };

  return (
    <>
      <div className='gmw-calculated-properties-action-container'>
        <Fieldset legend='Calculated Property Details' className='gmw-details-form'>
          <div className='gmw-field-legend-container'>
            <Text variant='small' as='small' className='gmw-field-legend'>
              Asterisk * indicates mandatory fields.
            </Text>
          </div>
          <SharedCalculatedPropertyForms
            validator={validator}
            propertyName={propertyName}
            setPropertyName={setPropertyName}
            type={type}
            setType={setType}
          />
        </Fieldset>
      </div>
      <ActionPanel
        onSave={onSave}
        onCancel={onClickCancel}
        isSavingDisabled={!(type && propertyName)}
        isLoading={isLoading}
      />
    </>
  );
};
