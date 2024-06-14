import React from "react";
import { RequiredFieldsNotice } from "./RequiredFieldsNotice";
import { Button, LabeledInput } from "@itwin/itwinui-react";
import type { Configuration } from "../ec3-widget-react";
import "./TemplateModificationStepOne.scss";

export interface TemplateModificationStepOneProps {
  currentStep: number;
  updateCurrentStep: (currentStep: number) => void;
  childTemplate: Configuration;
  updateChildTemplate: (childTemplate: Configuration) => void;
  onCancelClick: () => void;
}

export const TemplateModificationStepOne = (props: TemplateModificationStepOneProps) => {
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
          onChange={(event) => {
            props.updateChildTemplate({ ...props.childTemplate, displayName: event.target.value });
          }}
        />
        <LabeledInput
          id="reportDescription"
          name="description"
          className="ec3w-input-form"
          label="Description"
          value={props.childTemplate.description}
          onChange={(event) => {
            props.updateChildTemplate({ ...props.childTemplate, description: event.target.value });
          }}
        />
      </div>
      <div className="ec3w-stepper-footer">
        <Button
          className="ec3w-footer-button"
          styleType="high-visibility"
          onClick={() => props.updateCurrentStep(1)}
          disabled={props.childTemplate.displayName === "" || props.childTemplate.displayName === undefined}
        >
          Next
        </Button>
        <Button onClick={props.onCancelClick}>Cancel</Button>
      </div>
    </>
  );
};
