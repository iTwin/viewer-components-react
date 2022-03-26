/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Fieldset, LabeledInput, Small } from "@itwin/itwinui-react";
import React, { useState } from "react";
import ActionPanel from "./ActionPanel";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import { handleError, handleInputChange, WidgetHeader } from "./utils";
import "./ReportAction.scss";
import type { Report } from "../../reporting";
import { ReportingClient } from "../../reporting/reportingClient";
import { IModelApp } from "@itwin/core-frontend";

interface ReportActionProps {
  iTwinId: string;
  report?: Report;
  returnFn: () => Promise<void>;
}

const ReportAction = ({ iTwinId, report, returnFn }: ReportActionProps) => {
  const [values, setValues] = useState({
    name: report?.displayName ?? "",
    description: report?.description ?? "",
  });
  const [validator, showValidationMessage] = useValidator();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const onSave = async () => {
    try {
      if (!validator.allValid()) {
        showValidationMessage(true);
        return;
      }
      setIsLoading(true);
      const accessToken = (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
      const reportingClientApi = new ReportingClient();
      report
        ? await reportingClientApi.updateReport(accessToken, report.id ?? "", {
          displayName: values.name,
          description: values.description,
        })
        : await reportingClientApi.createReport(accessToken, {
          displayName: values.name,
          description: values.description,
          projectId: iTwinId,
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
        title={report ? IModelApp.localization.getLocalizedString("ReportsWidget:ModifyReport") : IModelApp.localization.getLocalizedString("ReportsWidget:AddReport")}
        returnFn={returnFn}
      />
      <div className='details-form-container'>
        <Fieldset legend='Report Details' className='details-form'>
          <Small className='field-legend'>
            {IModelApp.localization.getLocalizedString("ReportsWidget:MandatoryFields")}
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
            label={IModelApp.localization.getLocalizedString("ReportsWidget:Description")}
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
        actionLabel={IModelApp.localization.getLocalizedString("ReportsWidget:Add")}
        onAction={onSave}
        onCancel={returnFn}
        isSavingDisabled={!(values.name && values.description)}
        isLoading={isLoading}
      />
    </>
  );
};

export default ReportAction;
