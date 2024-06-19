/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React, { useCallback, useMemo } from "react";
import { RequiredFieldsNotice } from "./RequiredFieldsNotice";
import { Button, LabeledInput, LabeledSelect } from "@itwin/itwinui-react";
import type { Configuration, Report } from "../ec3-widget-react";
import "./TemplateModificationStepOne.scss";
import { useApiContext } from "./context/APIContext";
import type { useEC3WidgetLocalizationResult } from "../common/UseEC3WidgetLocalization";
import { useEC3WidgetLocalization } from "../common/UseEC3WidgetLocalization";

export interface TemplateModificationStepOneProps {
  currentStep: number;
  updateCurrentStep: (currentStep: number) => void;
  childTemplate: Configuration;
  updateChildTemplate: (childTemplate: Configuration) => void;
  onCancelClick: () => void;
  fetchedReports?: Report[];
  isLoading: boolean;
  localizedStrings?: useEC3WidgetLocalizationResult;
}

export const TemplateModificationStepOne = (props: TemplateModificationStepOneProps) => {
  const localizedStrings = useEC3WidgetLocalization(props.localizedStrings);
  const {
    config: { defaultReport },
  } = useApiContext();

  const onTemplateNameChange = useCallback(
    (event) => {
      props.updateChildTemplate({ ...props.childTemplate, displayName: event.target.value });
    },
    [props],
  );

  const onTemplateDescriptionChange = useCallback(
    (event) => {
      props.updateChildTemplate({ ...props.childTemplate, description: event.target.value });
    },
    [props],
  );
  const onTemplateReportChange = useCallback(
    (selectedReport) => {
      props.updateChildTemplate({ ...props.childTemplate, reportId: selectedReport });
    },
    [props],
  );

  const reportSelectionOptions = useMemo(() => {
    return (
      props.fetchedReports?.map((x) => {
        return {
          label: x.displayName,
          value: x.id,
        };
      }) ?? []
    );
  }, [props.fetchedReports]);

  return (
    <>
      <div className="ec3w-template-creation-step-one">
        <RequiredFieldsNotice localizedStrings={props.localizedStrings} />
        <LabeledInput
          id="reportName"
          label={localizedStrings.templateName}
          className="ec3w-input-form"
          data-testid="ec3-template-name-input"
          name="displayName"
          value={props.childTemplate.displayName}
          required
          onChange={onTemplateNameChange}
        />
        <LabeledInput
          id="reportDescription"
          name="description"
          className="ec3w-input-form"
          label={localizedStrings.templateDescription}
          value={props.childTemplate.description}
          onChange={onTemplateDescriptionChange}
        />
        {!defaultReport && (
          <LabeledSelect
            label={localizedStrings.reportSelection}
            className="ec3w-input-form"
            data-testid="ec3-report-selection"
            options={reportSelectionOptions}
            value={props.fetchedReports?.find((rp) => rp.id === props.childTemplate.reportId)?.id}
            onChange={onTemplateReportChange}
            placeholder={props.isLoading ? localizedStrings.reportSelectionPlaceholderLoading : localizedStrings.reportSelectionPlaceholderSelect}
            disabled={props.isLoading || props.childTemplate.reportId !== undefined}
          />
        )}
      </div>
      <div className="ec3w-stepper-footer">
        <Button
          data-testid="ec3-step-one-next-button"
          className="ec3w-footer-button"
          styleType="high-visibility"
          onClick={() => props.updateCurrentStep(1)}
          disabled={props.childTemplate.displayName === "" || props.childTemplate.displayName === undefined || props.childTemplate.reportId === undefined}
        >
          {localizedStrings.nextButton}
        </Button>
        <Button onClick={props.onCancelClick}>{localizedStrings.cancelButton}</Button>
      </div>
    </>
  );
};
