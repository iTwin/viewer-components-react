import React from "react";
import { TemplateModificationStepOne } from "./TemplateModificationStepOne";
import { TemplateModificationStepThree } from "./TemplateModificationStepThree";
import type { Configuration } from "./EC3/Template";
import { TemplateModificationStepTwo } from "./TemplateModificationStepTwo";
import type { Report } from "@itwin/insights-client";

export interface TemplateModificationStepRendererProps {
  currentStep: number;
  updateCurrentStep: (currentStep: number) => void;
  childTemplate: Configuration;
  updateChildTemplate: (childTemplate: Configuration) => void;
  onCancelClick: () => void;
  onSaveClick: () => Promise<void>;
  fetchedReports: Report[];
}

export const TemplateModificationStepRenderer = (props: TemplateModificationStepRendererProps) => {
  const renderSteps = () => {
    switch (props.currentStep) {
      case 0: {
        return <TemplateModificationStepOne {...props} />;
      }
      case 1: {
        return (
          <TemplateModificationStepTwo
            template={props.childTemplate}
            updateCurrentStep={props.updateCurrentStep}
            onCancelClick={props.onCancelClick}
            setTemplate={props.updateChildTemplate}
            fetchedReports={props.fetchedReports}
          />
        );
      }
      case 2: {
        return <TemplateModificationStepThree {...props} />;
      }
      default:
        return <></>;
    }
  };
  return renderSteps();
};
