/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Fieldset, LabeledInput, Small, ToggleSwitch } from "@itwin/itwinui-react";
import React, { useContext, useState } from "react";
import ActionPanel from "./ActionPanel";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import { handleError, handleInputChange, WidgetHeader } from "./utils";
import "./MappingAction.scss";
import { useMappingClient } from "./context/MappingClientContext";
import type { Mapping } from "@itwin/insights-client";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";

interface MappingActionProps {
  iModelId: string;
  mapping?: Mapping;
  returnFn: () => Promise<void>;
}

const MappingAction = ({ iModelId, mapping, returnFn }: MappingActionProps) => {
  const apiContext = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const [values, setValues] = useState({
    name: mapping?.mappingName ?? "",
    description: mapping?.description ?? "",
    extractionEnabled: mapping?.extractionEnabled ?? true,
  });
  const [validator, showValidationMessage] = useValidator();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // TODO ERRORED STATE
  const onSave = async () => {
    try {
      if (!validator.allValid()) {
        showValidationMessage(true);
        return;
      }
      setIsLoading(true);
      const accessToken = await apiContext.getAccessToken();
      mapping
        ? await mappingClient.updateMapping(accessToken, iModelId, mapping.id ?? "", {
          mappingName: values.name,
          description: values.description,
          extractionEnabled: values.extractionEnabled,
        })
        : await mappingClient.createMapping(accessToken, iModelId, {
          mappingName: values.name,
          description: values.description,
          extractionEnabled: values.extractionEnabled,
        });
      await returnFn();
    } catch (error: any) {
      handleError(error.status);
      setIsLoading(false);
    }
  };

  return (
    <>
      <WidgetHeader
        title={mapping ? "Modify Mapping" : "Add Mapping"}
        returnFn={returnFn}
      />
      <div className='details-form-container'>
        <Fieldset legend='Mapping Details' className='details-form'>
          <Small className='field-legend'>
            Asterisk * indicates mandatory fields.
          </Small>
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
        onCancel={returnFn}
        isSavingDisabled={!values.name}
        isLoading={isLoading}
      />
    </>
  );
};

export default MappingAction;
