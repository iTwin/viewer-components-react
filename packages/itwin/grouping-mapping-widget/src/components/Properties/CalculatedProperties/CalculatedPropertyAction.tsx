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
import type { CalculatedProperty, Group } from "@itwin/insights-client";
import { CalculatedPropertyType } from "@itwin/insights-client";
import { SharedCalculatedPropertyForms } from "./SharedCalculatedPropertyForms";
import { useGroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import { useMappingClient } from "../../context/MappingClientContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Props for the {@link CalculatedPropertyAction} component.
 * @public
 */
export interface CalculatedPropertyActionProps {
  mappingId: string;
  group: Group;
  calculatedProperty?: CalculatedProperty;
  onSaveSuccess: () => void;
  onClickCancel?: () => void;
}

/**
 * Component to create or update a calculated property.
 * @public
 */
export const CalculatedPropertyAction = ({
  mappingId,
  group,
  calculatedProperty,
  onSaveSuccess,
  onClickCancel,
}: CalculatedPropertyActionProps) => {
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const [propertyName, setPropertyName] = useState<string>(
    calculatedProperty?.propertyName ?? "",
  );
  const [type, setType] = useState<CalculatedPropertyType | undefined>(calculatedProperty?.type);
  const [validator, showValidationMessage] = useValidator();
  const queryClient = useQueryClient();

  const { mutate: saveMutation, isLoading } = useMutation(async (type: CalculatedPropertyType) => {
    const accessToken = await getAccessToken();

    return calculatedProperty
      ? mappingClient.updateCalculatedProperty(
        accessToken,
        iModelId,
        mappingId,
        group.id,
        calculatedProperty.id,
        { propertyName, type },
      )
      : mappingClient.createCalculatedProperty(
        accessToken,
        iModelId,
        mappingId,
        group.id,
        { propertyName, type },
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
