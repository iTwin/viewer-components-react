/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { SvgInfoCircular } from "@itwin/itwinui-icons-react";
import { Button, Text } from "@itwin/itwinui-react";
import React from "react";
import type { Configuration } from "./EC3/Template";
import "./TemplateModificationStepThree.scss";

export interface TemplateModificationStepThreeProps {
  currentStep: number;
  updateCurrentStep: (currentStep: number) => void;
  childTemplate: Configuration;
  onCancelClick: () => void;
  onSaveClick: () => Promise<void>;
}

export const TemplateModificationStepThree = (props: TemplateModificationStepThreeProps) => {
  return (
    <>
      <div className="ec3w-template-creation-step-three">
        <Text className="ec3w-summary-text">Selection Summary :</Text>
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
          Back
        </Button>
        <Button
          data-testid="ec3-save-button"
          className="ec3w-footer-button"
          styleType="high-visibility"
          onClick={async () => {
            await props.onSaveClick();
          }}
        >
          Save
        </Button>
        <Button onClick={props.onCancelClick}>Cancel</Button>
      </div>
    </>
  );
};
