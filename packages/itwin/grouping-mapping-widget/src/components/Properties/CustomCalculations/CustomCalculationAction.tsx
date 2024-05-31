/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  Alert,
  ExpandableBlock,
  Icon,
  InputGroup,
  LabeledTextarea,
} from "@itwin/itwinui-react";
import React from "react";
import "./CustomCalculationAction.scss";
import { SvgFunction } from "@itwin/itwinui-icons-react";

/**
 * Props for the {@link CustomCalculationAction} component.
 * @public
 */
export interface CustomCalculationActionProps {
  formula?: string;
  setFormula: (formula: string | undefined) => void;
  formulaErrorMessage?: string;
  forceValidation: () => void;
  disabled?: boolean;
}

/**
 * Component to create or update a custom calculation property.
 * @public
 */
export const CustomCalculationAction = ({
  formula,
  setFormula,
  formulaErrorMessage,
  forceValidation,
  disabled,
}: CustomCalculationActionProps) => {
  return (
    <ExpandableBlock
      title={"Custom Calculation"}
      endIcon={
        <Icon fill={formula ? "informational" : "default"}>
          <SvgFunction />
        </Icon>
      }
      isExpanded={formula ? true : false}>
      <div className='gmw-custom-calculation-action-container'>
        <InputGroup className='gmw-details-form'>
          <Alert
            type='informational'
            clickableText='Click here.'
            clickableTextProps={{ href: "https://developer.bentley.com/apis/grouping-and-mapping/operations/create-property/#customcalculations", target: "_blank", rel: "noreferrer" }}
          >
            To learn more about creating custom calculation formulas, view the documentation.
          </Alert>
          <LabeledTextarea
            value={formula}
            name='formula'
            label='Formula'
            disabled={disabled}
            onChange={(event) => {
              setFormula(event.target.value);
            }}
            message={formulaErrorMessage}
            status={formulaErrorMessage ? "negative" : undefined}
            onBlurCapture={() => {
              forceValidation();
            }}
          />
        </InputGroup>
      </div>
    </ExpandableBlock>
  );
};
