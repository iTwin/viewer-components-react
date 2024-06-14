import React, { useCallback } from "react";
import { RequiredFieldsNotice } from "./RequiredFieldsNotice";
import { Button, LabeledInput, LabeledSelect } from "@itwin/itwinui-react";
import type { Configuration, Report } from "../ec3-widget-react";
import "./TemplateModificationStepOne.scss";
import { useApiContext } from "./context/APIContext";

export interface TemplateModificationStepOneProps {
  currentStep: number;
  updateCurrentStep: (currentStep: number) => void;
  childTemplate: Configuration;
  updateChildTemplate: (childTemplate: Configuration) => void;
  onCancelClick: () => void;
  fetchedReports?: Report[];
  isLoading: boolean;
}

export const TemplateModificationStepOne = (props: TemplateModificationStepOneProps) => {
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
  return (
    <>
      <div className="ec3w-template-creation-step-one">
        <RequiredFieldsNotice />
        <LabeledInput
          id="reportName"
          label="Name"
          className="ec3w-input-form"
          name="displayName"
          value={props.childTemplate.displayName}
          required
          onChange={onTemplateNameChange}
        />
        <LabeledInput
          id="reportDescription"
          name="description"
          className="ec3w-input-form"
          label="Description"
          value={props.childTemplate.description}
          onChange={onTemplateDescriptionChange}
        />
        {!defaultReport && (
          <LabeledSelect
            label="Select Report"
            className="ec3w-input-form"
            data-testid="ec3-report-select"
            options={
              props.fetchedReports?.map((x) => {
                return {
                  label: x.displayName,
                  value: x.id,
                };
              }) ?? []
            }
            value={props.fetchedReports?.find((rp) => rp.id === props.childTemplate.reportId)?.id}
            onChange={onTemplateReportChange}
            placeholder={props.isLoading ? "Loading reports..." : "Select report"}
            disabled={props.isLoading}
          />
        )}
      </div>
      <div className="ec3w-stepper-footer">
        <Button
          className="ec3w-footer-button"
          styleType="high-visibility"
          onClick={() => props.updateCurrentStep(1)}
          disabled={props.childTemplate.displayName === "" || props.childTemplate.displayName === undefined || props.childTemplate.reportId === undefined}
        >
          Next
        </Button>
        <Button onClick={props.onCancelClick}>Cancel</Button>
      </div>
    </>
  );
};
