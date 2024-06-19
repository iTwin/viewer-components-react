/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { TemplateModificationStepOne } from "./TemplateModificationStepOne";
import { TemplateModificationStepThree } from "./TemplateModificationStepThree";
import type { Configuration } from "./EC3/Template";
import { TemplateModificationStepTwo } from "./TemplateModificationStepTwo";
import type { Report } from "@itwin/insights-client";
import type { useEC3WidgetLocalizationResult } from "../common/UseEC3WidgetLocalization";

export interface TemplateModificationStepRendererProps {
  currentStep: number;
  updateCurrentStep: (currentStep: number) => void;
  childTemplate: Configuration;
  updateChildTemplate: (childTemplate: Configuration) => void;
  onCancelClick: () => void;
  onSaveClick: () => Promise<void>;
  fetchedReports: Report[];
  isLoading: boolean;
  localizedStrings?: useEC3WidgetLocalizationResult;
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
            localizedStrings={props.localizedStrings}
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
        return null;
    }
  };
  return renderSteps();
};
