/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Fieldset, LabeledInput, Small } from "@itwin/itwinui-react";
import React, { useState } from "react";
import type { MappingReportingAPI } from "../../api/generated/api";
import { reportingClientApi } from "../../api/reportingClient";
import ActionPanel from "./ActionPanel";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import { handleError, handleInputChange, WidgetHeader } from "./utils";
import "./MappingAction.scss";

interface MappingActionProps {
  iModelId: string;
  mapping?: MappingReportingAPI;
  returnFn: () => Promise<void>;
}

const MappingAction = ({ iModelId, mapping, returnFn }: MappingActionProps) => {
  const [values, setValues] = useState({
    name: mapping?.mappingName ?? "",
    description: mapping?.description ?? "",
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
      mapping
        ? await reportingClientApi.updateMapping(iModelId, mapping.id ?? "", {
          mappingName: values.name,
          description: values.description,
        })
        : await reportingClientApi.createMapping(iModelId, {
          mappingName: values.name,
          description: values.description,
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
            required
            name='description'
            label='Description'
            value={values.description}
            onChange={(event) => {
              handleInputChange(event, values, setValues);
              validator.showMessageFor("description");
            }}
            message={validator.message(
              "description",
              values.description,
              "required",
            )}
            status={
              validator.message("description", values.description, "required")
                ? "negative"
                : undefined
            }
            onBlur={() => {
              validator.showMessageFor("description");
            }}
            onBlurCapture={(event) => {
              handleInputChange(event, values, setValues);
              validator.showMessageFor("description");
            }}
          />
        </Fieldset>
      </div>
      <ActionPanel
        onSave={onSave}
        onCancel={returnFn}
        disabled={!(values.name && values.description)}
        isLoading={isLoading}
      />
    </>
  );
};

export default MappingAction;
