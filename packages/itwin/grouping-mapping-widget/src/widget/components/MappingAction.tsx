/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Fieldset, LabeledInput, Text, ToggleSwitch } from "@itwin/itwinui-react";
import React, { useState } from "react";
import ActionPanel from "./ActionPanel";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import { handleError, handleInputChange } from "./utils";
import "./MappingAction.scss";
import { useMappingClient } from "./context/MappingClientContext";
import type { Mapping } from "@itwin/insights-client";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";

const defaultDisplayStrings = {
  mappingDetails: "Mapping Details",
};

export interface MappingActionProps {
  mapping?: Mapping;
  onSaveSuccess: () => void;
  onClickCancel?: () => void;
  displayStrings?: Partial<typeof defaultDisplayStrings>;
}

export const MappingAction = ({ mapping, onSaveSuccess, onClickCancel, displayStrings: userDisplayStrings }: MappingActionProps) => {
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const [values, setValues] = useState({
    name: mapping?.mappingName ?? "",
    description: mapping?.description ?? "",
    extractionEnabled: mapping?.extractionEnabled ?? true,
  });
  const [validator, showValidationMessage] = useValidator();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const displayStrings = React.useMemo(
    () => ({ ...defaultDisplayStrings, ...userDisplayStrings }),
    [userDisplayStrings]
  );

  const onSave = async () => {
    try {
      if (!validator.allValid()) {
        showValidationMessage(true);
        return;
      }
      setIsLoading(true);
      const accessToken = await getAccessToken();
      mapping
        ? await mappingClient.updateMapping(accessToken, iModelId, mapping.id, {
          mappingName: values.name,
          description: values.description,
          extractionEnabled: values.extractionEnabled,
        })
        : await mappingClient.createMapping(accessToken, iModelId, {
          mappingName: values.name,
          description: values.description,
          extractionEnabled: values.extractionEnabled,
        });
      setValues({
        name: mapping?.mappingName ?? "",
        description: mapping?.description ?? "",
        extractionEnabled: mapping?.extractionEnabled ?? true,
      });
      onSaveSuccess();
    } catch (error: any) {
      handleError(error.status);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className='gmw-details-form-container'>
        <Fieldset legend={displayStrings.mappingDetails} className='gmw-details-form'>
          <Text variant='small' as='small' className='gmw-field-legend'>
            Asterisk * indicates mandatory fields.
          </Text>
          <LabeledInput
            id='name'
            name='name'
            label='Name'
            value={values.name}
            required
            onChange={(event) => {
              handleInputChange(event, values, setValues);
              validator.showMessageFor("name");
            }}
            message={validator.message("name", values.name, NAME_REQUIREMENTS)}
            status={
              validator.message("name", values.name, NAME_REQUIREMENTS)
                ? "negative"
                : undefined
            }
            onBlur={() => {
              validator.showMessageFor("name");
            }}
            onBlurCapture={(event) => {
              handleInputChange(event, values, setValues);
              validator.showMessageFor("name");
            }}
          />
          <LabeledInput
            id='description'
            name='description'
            label='Description'
            value={values.description}
            onChange={(event) => {
              handleInputChange(event, values, setValues);
            }}
          />
          <ToggleSwitch
            id='extractionEnabled'
            name='extractionEnabled'
            label='Extract data from iModel'
            labelPosition="right"
            checked={values.extractionEnabled}
            onChange={(event) => {
              setValues({ ...values, extractionEnabled: event.currentTarget.checked });
            }}
          />
        </Fieldset>
      </div>
      <ActionPanel
        onSave={onSave}
        onCancel={onClickCancel}
        isSavingDisabled={!values.name}
        isLoading={isLoading}
      />
    </>
  );
};
