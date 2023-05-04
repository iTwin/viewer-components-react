/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Fieldset, LabeledInput, Small } from "@itwin/itwinui-react";
import React, { useState } from "react";
import ActionPanel from "./ActionPanel";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import {
  generateUrl,
  handleError,
  handleInputChange,
} from "./utils";
import "./ReportAction.scss";
import type { Report } from "@itwin/insights-client";
import { REPORTING_BASE_PATH, ReportsClient } from "@itwin/insights-client";
import { useReportsApiConfig } from "../context/ReportsApiConfigContext";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";

export interface ReportActionProps {
  report?: Report;
  onSaveSuccess: () => void;
  onClickCancel?: () => void;
}

export const ReportAction = ({ report, onSaveSuccess, onClickCancel }: ReportActionProps) => {
  const { iTwinId, getAccessToken, baseUrl } = useReportsApiConfig();
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
      const reportsClientApi = new ReportsClient(
        generateUrl(REPORTING_BASE_PATH, baseUrl)
      );
      const accessToken = await getAccessToken();
      report
        ? await reportsClientApi.updateReport(accessToken, report.id ?? "", {
          displayName: values.name,
          description: values.description,
        })
        : await reportsClientApi.createReport(accessToken, {
          displayName: values.name,
          description: values.description,
          projectId: iTwinId,
        });
      onSaveSuccess();
    } catch (error: any) {
      handleError(error.status);
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="rcw-details-form-container">
        <Fieldset
          legend={ReportsConfigWidget.localization.getLocalizedString(
            "ReportsConfigWidget:ReportDetails"
          )}
          className="rcw-details-form"
        >
          <Small className="field-legend">
            {ReportsConfigWidget.localization.getLocalizedString(
              "ReportsConfigWidget:MandatoryFields"
            )}
          </Small>
          <LabeledInput
            name="name"
            label={ReportsConfigWidget.localization.getLocalizedString(
              "ReportsConfigWidget:Name"
            )}
            value={values.name}
            required
            disabled={isLoading}
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
            name="description"
            label={ReportsConfigWidget.localization.getLocalizedString(
              "ReportsConfigWidget:Description"
            )}
            value={values.description}
            onChange={(event) => {
              handleInputChange(event, values, setValues);
            }}
            disabled={isLoading}
          />
        </Fieldset>
      </div>
      <ActionPanel
        actionLabel={ReportsConfigWidget.localization.getLocalizedString(
          "ReportsConfigWidget:Add"
        )}
        onAction={onSave}
        onCancel={onClickCancel}
        isSavingDisabled={!values.name}
        isLoading={isLoading}
      />
    </>
  );
};

