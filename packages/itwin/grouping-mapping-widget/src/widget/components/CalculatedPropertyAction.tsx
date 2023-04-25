/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  Fieldset,
  Small,
} from "@itwin/itwinui-react";
import React, { useState } from "react";
import ActionPanel from "./ActionPanel";
import useValidator from "../hooks/useValidator";
import { handleError } from "./utils";
import "./CalculatedPropertyAction.scss";
import { useMappingClient } from "./context/MappingClientContext";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import type { CalculatedProperty, Group } from "@itwin/insights-client";
import { CalculatedPropertyType } from "@itwin/insights-client";
import { SharedCalculatedPropertyForms } from "./SharedCalculatedPropertyForms";

export interface CalculatedPropertyActionProps {
  mappingId: string;
  group: Group;
  calculatedProperty?: CalculatedProperty;
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
  const mappingClient = useMappingClient();
  const [propertyName, setPropertyName] = useState<string>(
    calculatedProperty?.propertyName ?? "",
  );
  const [type, setType] = useState<CalculatedPropertyType | undefined>(calculatedProperty?.type);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [validator, showValidationMessage] = useValidator();

  const onSave = async () => {
    if (!validator.allValid() || !type) {
      showValidationMessage(true);
      return;
    }
    try {
      setIsLoading(true);

      const accessToken = await getAccessToken();

      calculatedProperty
        ? await mappingClient.updateCalculatedProperty(
          accessToken,
          iModelId,
          mappingId,
          group.id,
          calculatedProperty.id,
          {
            propertyName,
            type,
          },
        )
        : await mappingClient.createCalculatedProperty(
          accessToken,
          iModelId,
          mappingId,
          group.id,
          {
            propertyName,
            type,
          },
        );
      onSaveSuccess();
      setPropertyName("");
      setType(CalculatedPropertyType.Undefined);
    } catch (error: any) {
      handleError(error.status);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className='gmw-calculated-properties-action-container'>
        <Fieldset legend='Calculated Property Details' className='gmw-details-form'>
          <div className='gmw-field-legend-container'>
            <Small className='gmw-field-legend'>
              Asterisk * indicates mandatory fields.
            </Small>
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
