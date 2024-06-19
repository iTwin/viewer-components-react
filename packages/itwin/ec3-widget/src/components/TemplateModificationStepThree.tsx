/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { SvgInfoCircular } from "@itwin/itwinui-icons-react";
import { Button, Text } from "@itwin/itwinui-react";
import React from "react";
import type { Configuration } from "./EC3/Template";
import "./TemplateModificationStepThree.scss";
import type { useEC3WidgetLocalizationResult } from "../common/UseEC3WidgetLocalization";
import { useEC3WidgetLocalization } from "../common/UseEC3WidgetLocalization";

export interface TemplateModificationStepThreeProps {
  currentStep: number;
  updateCurrentStep: (currentStep: number) => void;
  childTemplate: Configuration;
  onCancelClick: () => void;
  onSaveClick: () => Promise<void>;
  localizedStrings?: useEC3WidgetLocalizationResult;
}

export const TemplateModificationStepThree = (props: TemplateModificationStepThreeProps) => {
  const localizedStrings = useEC3WidgetLocalization(props.localizedStrings);
  return (
    <>
      <div className="ec3w-template-creation-step-three">
        <Text className="ec3w-summary-text">{localizedStrings.selectionSummary}</Text>
        {props.childTemplate.labels.map((x) => (
          <div className="ec3w-assembly-name-list" key={x.name}>
            <SvgInfoCircular />
            <Text data-testid="ec3-assembly-name-list" className="ec3w-assembly-name">
              {x.name}
            </Text>
          </div>
        ))}
      </div>
      <div className="ec3w-stepper-footer">
        <Button className="ec3w-footer-button" onClick={() => props.updateCurrentStep(1)}>
          {localizedStrings.backButton}
        </Button>
        <Button
          data-testid="ec3-save-button"
          className="ec3w-footer-button"
          styleType="high-visibility"
          onClick={async () => {
            await props.onSaveClick();
          }}
        >
          {localizedStrings.saveButton}
        </Button>
        <Button onClick={props.onCancelClick}>{localizedStrings.cancelButton}</Button>
      </div>
    </>
  );
};
